import { doc, getDoc, setDoc, collection, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';
import { getPermanentConfig, savePermanentConfig } from './excel-db';

export interface SmartlinkRecord {
  id: string;
  name: string;
  url: string;
  baseUrl?: string;
  subIds?: Record<string, string>;
  weight: number; // 1-100 for weighted rotation
  priority: number; // 1-10 (higher = priority)
  clicks: number;
  active: boolean;
  categoryTargets?: string[];
  createdAt: string;
  lastUsedAt?: string;
}

export type MonetizationMode = 'new_tab' | 'interstitial' | 'redirect' | 'disabled';
export type MonetizationTrigger = 'video_click' | 'play_button' | 'download_button' | 'any_action';
export type RotationStrategy = 'round_robin' | 'weighted_random' | 'priority' | 'category_target';

export interface MonetizationSettings {
  enabled: boolean;
  interval: number; // 1, 2, 3, 4, 5
  mode: MonetizationMode;
  trigger: MonetizationTrigger;
  cooldownSeconds: number;
  rotationStrategy: RotationStrategy;
  smartlinks: SmartlinkRecord[];
  defaultSmartlinkUrl: string;
  antiAbuseEnabled: boolean;
  popunderRate: number;
  popunderUrl?: string;
  bannerTopHtml?: string;
  playerOverlayHtml?: string;
  nativeAdHtml?: string;
  updatedAt?: string;
}

const DEFAULT_SMARTLINKS: SmartlinkRecord[] = [
  {
    id: 'slink_default_1',
    name: 'Adsterra Smartlink Main #1',
    url: 'https://pl30817522.effectivecpmnetwork.com/d1/da/6d/d1da6dca3edd85a05e5e4ba7572c3d33.js',
    weight: 50,
    priority: 1,
    clicks: 0,
    active: true,
    categoryTargets: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'slink_default_2',
    name: 'Adsterra Direct Link #2',
    url: 'https://otieuwou.net/4/8912345',
    weight: 30,
    priority: 2,
    clicks: 0,
    active: true,
    categoryTargets: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'slink_default_3',
    name: 'High CPM Smartlink #3',
    url: 'https://highrevenuegate.com/direct/premium_stream',
    weight: 20,
    priority: 3,
    clicks: 0,
    active: true,
    categoryTargets: [],
    createdAt: new Date().toISOString(),
  }
];

export const DEFAULT_MONETIZATION_CONFIG: MonetizationSettings = {
  enabled: true,
  interval: 3, // Default interval 3: 2 video clicks -> 1 ad click
  mode: 'new_tab',
  trigger: 'video_click',
  cooldownSeconds: 30,
  rotationStrategy: 'round_robin',
  smartlinks: DEFAULT_SMARTLINKS,
  defaultSmartlinkUrl: 'https://pl30817522.effectivecpmnetwork.com/d1/da/6d/d1da6dca3edd85a05e5e4ba7572c3d33.js',
  antiAbuseEnabled: true,
  popunderRate: 100,
  popunderUrl: 'https://pl30817522.effectivecpmnetwork.com/d1/da/6d/d1da6dca3edd85a05e5e4ba7572c3d33.js',
  bannerTopHtml: `<div class="w-full max-w-[800px] aspect-[4/1] mx-auto overflow-hidden flex items-center justify-center bg-[#0f1422] border border-amber-500/30 rounded-2xl p-2 shadow-lg"><script async="async" data-cfasync="false" src="https://pl30817733.effectivecpmnetwork.com/4045af9e74f05790b727b7c208314777/invoke.js"></script><div id="container-4045af9e74f05790b727b7c208314777"></div></div>`,
  playerOverlayHtml: `<div class="flex justify-center items-center my-1"><script>atOptions = {'key' : 'f8eb57861126a6d63865b2645c52d941','format' : 'iframe','height' : 60,'width' : 468,'params' : {}};</script><script src="https://www.highperformanceformat.com/f8eb57861126a6d63865b2645c52d941/invoke.js"></script></div>`,
  nativeAdHtml: `<div class="flex justify-center items-center my-2 p-2 bg-[#0f1422] border border-amber-500/30 rounded-2xl shadow-lg"><script>atOptions = {'key' : 'f8eb57861126a6d63865b2645c52d941','format' : 'iframe','height' : 60,'width' : 468,'params' : {}};</script><script src="https://www.highperformanceformat.com/f8eb57861126a6d63865b2645c52d941/invoke.js"></script></div>`,
};

// In-memory cache for fast lookups
let cachedConfig: MonetizationSettings | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 10000; // 10s cache

// Session click tracker in server memory (hashed visitor ID -> { count, lastClickTime })
interface VisitorSession {
  count: number;
  lastAdTime: number;
  lastClickTime: number;
}
const sessionStore = new Map<string, VisitorSession>();

// Cleanup stale sessions every 10 mins
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  for (const [key, val] of sessionStore.entries()) {
    if (now - val.lastClickTime > maxAge) {
      sessionStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

let roundRobinIndex = 0;

/**
 * Get the current monetization configuration from Firestore (or cache/fallback)
 */
export async function getMonetizationConfig(): Promise<MonetizationSettings> {
  const now = Date.now();
  if (cachedConfig && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedConfig;
  }

  let result: MonetizationSettings = { ...DEFAULT_MONETIZATION_CONFIG };

  try {
    const configDocRef = doc(db, 'settings', 'monetization');
    const docSnap = await getDoc(configDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as Partial<MonetizationSettings>;
      result = {
        ...DEFAULT_MONETIZATION_CONFIG,
        ...data,
        smartlinks: Array.isArray(data.smartlinks) && data.smartlinks.length > 0
          ? data.smartlinks
          : DEFAULT_SMARTLINKS,
      };
      cachedConfig = result;
      lastFetchTime = now;
      return result;
    }
  } catch (err) {
    console.warn('Error reading monetization config from Firestore, falling back to local:', err);
  }

  // Fallback to permanent config from config.json or defaults
  const perm = getPermanentConfig();
  if (perm.monetization) {
    result = {
      ...DEFAULT_MONETIZATION_CONFIG,
      ...perm.monetization,
    };
  } else {
    result = { ...DEFAULT_MONETIZATION_CONFIG };
  }

  cachedConfig = result;
  lastFetchTime = now;
  return result;
}

/**
 * Save monetization configuration to Firestore and local backup
 */
export async function saveMonetizationConfig(updates: Partial<MonetizationSettings>): Promise<MonetizationSettings> {
  const current = await getMonetizationConfig();
  const updated: MonetizationSettings = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // Validate interval (1-5)
  if (updated.interval < 1) updated.interval = 1;
  if (updated.interval > 5) updated.interval = 5;

  try {
    const configDocRef = doc(db, 'settings', 'monetization');
    await setDoc(configDocRef, updated, { merge: true });
  } catch (err) {
    console.warn('Failed to save monetization config to Firestore:', err);
  }

  // Also save to config.json
  try {
    savePermanentConfig({
      monetization: updated,
      ad_monetization_enabled: updated.enabled,
      ad_popunder_rate: updated.popunderRate,
      ad_popunder_url: updated.popunderUrl || updated.defaultSmartlinkUrl,
      ad_banner_top_html: updated.bannerTopHtml,
      ad_player_overlay_html: updated.playerOverlayHtml,
      ad_native_html: updated.nativeAdHtml,
    });
  } catch (err) {
    console.warn('Failed to save to config.json:', err);
  }

  cachedConfig = updated;
  lastFetchTime = Date.now();
  return updated;
}

/**
 * Generate multiple smartlinks with customizable tracking parameters / subIDs
 */
export interface GenerateSmartlinkOptions {
  baseUrl: string;
  count: number;
  namePrefix?: string;
  subIdPrefix?: string;
  placementTag?: string;
  weight?: number;
  priority?: number;
  categoryTargets?: string[];
}

export async function generateSmartlinks(options: GenerateSmartlinkOptions): Promise<SmartlinkRecord[]> {
  const {
    baseUrl,
    count = 5,
    namePrefix = 'Adsterra Smartlink',
    subIdPrefix = 'sub',
    placementTag = 'video_player',
    weight = 50,
    priority = 1,
    categoryTargets = [],
  } = options;

  const validCount = Math.min(Math.max(1, count), 50); // 1 to 50 smartlinks at once
  const cleanBaseUrl = baseUrl.trim();
  const generated: SmartlinkRecord[] = [];

  for (let i = 1; i <= validCount; i++) {
    const randomHex = Math.random().toString(36).substring(2, 8);
    const sub1 = `${subIdPrefix}_${i}_${randomHex}`;
    const sub2 = placementTag;
    const timestamp = Date.now();

    // Construct URL with parameters if base URL is an HTTP link
    let finalUrl = cleanBaseUrl;
    if (cleanBaseUrl.startsWith('http')) {
      const urlObj = new URL(cleanBaseUrl);
      urlObj.searchParams.set('subid1', sub1);
      urlObj.searchParams.set('subid2', sub2);
      urlObj.searchParams.set('subid3', `${i}`);
      urlObj.searchParams.set('t', `${timestamp}`);
      finalUrl = urlObj.toString();
    }

    const newLink: SmartlinkRecord = {
      id: `slink_${Date.now()}_${i}_${randomHex}`,
      name: `${namePrefix} #${i} [${sub1}]`,
      url: finalUrl,
      baseUrl: cleanBaseUrl,
      subIds: {
        subid1: sub1,
        subid2: sub2,
        subid3: `${i}`,
      },
      weight: weight,
      priority: priority,
      clicks: 0,
      active: true,
      categoryTargets: categoryTargets,
      createdAt: new Date().toISOString(),
    };

    generated.push(newLink);
  }

  // Merge into existing pool
  const currentConfig = await getMonetizationConfig();
  const existingLinks = currentConfig.smartlinks || [];
  const updatedSmartlinks = [...existingLinks, ...generated];

  await saveMonetizationConfig({
    smartlinks: updatedSmartlinks,
  });

  return generated;
}

/**
 * Select next smartlink from pool based on rotation strategy and category filter
 */
export function selectSmartlinkFromPool(
  smartlinks: SmartlinkRecord[],
  strategy: RotationStrategy,
  categoryId?: string
): SmartlinkRecord | null {
  const activeLinks = smartlinks.filter(l => l.active);
  if (activeLinks.length === 0) return null;

  // Filter by category target if strategy is category_target or matching targets exist
  let targetPool = activeLinks;
  if (categoryId) {
    const categoryMatched = activeLinks.filter(
      l => l.categoryTargets && l.categoryTargets.length > 0 && l.categoryTargets.includes(categoryId)
    );
    if (categoryMatched.length > 0) {
      targetPool = categoryMatched;
    }
  }

  if (targetPool.length === 1) {
    return targetPool[0];
  }

  if (strategy === 'round_robin') {
    roundRobinIndex = (roundRobinIndex + 1) % targetPool.length;
    return targetPool[roundRobinIndex];
  }

  if (strategy === 'priority') {
    // Sort by priority descending
    const sorted = [...targetPool].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    return sorted[0];
  }

  if (strategy === 'weighted_random') {
    const totalWeight = targetPool.reduce((acc, l) => acc + (l.weight || 10), 0);
    let randomVal = Math.random() * totalWeight;
    for (const link of targetPool) {
      randomVal -= (link.weight || 10);
      if (randomVal <= 0) {
        return link;
      }
    }
    return targetPool[0];
  }

  // Default: Random selection
  const randomIndex = Math.floor(Math.random() * targetPool.length);
  return targetPool[randomIndex];
}

/**
 * Process a user click, calculate interval logic on server, and return trigger decision
 */
export interface ProcessClickParams {
  visitorId: string;
  videoId?: string;
  categoryId?: string;
  triggerType?: MonetizationTrigger;
  videoMonetizationOverride?: 'inherit' | 'enabled' | 'disabled';
  videoSmartlinkOverride?: string;
}

export interface ProcessClickResult {
  triggered: boolean;
  mode: MonetizationMode;
  smartlinkUrl: string | null;
  clickNumber: number;
  interval: number;
  cooldownActive: boolean;
  rotationStrategy: RotationStrategy;
  selectedSmartlinkId?: string;
  selectedSmartlinkName?: string;
}

export async function processMonetizationClick(params: ProcessClickParams): Promise<ProcessClickResult> {
  const config = await getMonetizationConfig();
  const now = Date.now();
  const visitorId = params.visitorId || 'anon_visitor';

  // 1. Resolve Precedence: Video Override > Global Config
  if (params.videoMonetizationOverride === 'disabled' || config.mode === 'disabled' || !config.enabled) {
    return {
      triggered: false,
      mode: 'disabled',
      smartlinkUrl: null,
      clickNumber: 0,
      interval: config.interval,
      cooldownActive: false,
      rotationStrategy: config.rotationStrategy,
    };
  }

  // 2. Manage Server-side Session Click Tracking
  let session = sessionStore.get(visitorId);
  if (!session) {
    session = {
      count: 0,
      lastAdTime: 0,
      lastClickTime: now,
    };
  }

  session.count += 1;
  session.lastClickTime = now;
  const currentClickNumber = session.count;

  // 3. Check Cooldown
  const cooldownMs = (config.cooldownSeconds || 0) * 1000;
  const inCooldown = session.lastAdTime > 0 && (now - session.lastAdTime < cooldownMs);

  // 4. Calculate Interval Logic (1, 2, 3, 4, 5)
  // Interval 1: 1, 2, 3, 4, 5 -> every click triggers
  // Interval 2: 2, 4, 6... -> every 2nd click
  // Interval 3: 3, 6, 9... -> every 3rd click
  // Interval 4: 4, 8, 12... -> every 4th click
  // Interval 5: 5, 10, 15... -> every 5th click
  const interval = Math.min(Math.max(1, config.interval || 3), 5);
  const isIntervalMatch = (currentClickNumber % interval) === 0;

  let shouldTrigger = isIntervalMatch && !inCooldown;

  if (params.videoMonetizationOverride === 'enabled' && !inCooldown) {
    // If video explicitly forces enabled, follow interval
    shouldTrigger = isIntervalMatch;
  }

  let finalSmartlinkUrl: string | null = null;
  let selectedLink: SmartlinkRecord | null = null;

  if (shouldTrigger) {
    // Check if per-video custom smartlink is provided
    if (params.videoSmartlinkOverride && params.videoSmartlinkOverride.trim().length > 0) {
      finalSmartlinkUrl = params.videoSmartlinkOverride.trim();
    } else {
      // Pick from Smartlink pool
      selectedLink = selectSmartlinkFromPool(config.smartlinks, config.rotationStrategy, params.categoryId);
      if (selectedLink) {
        finalSmartlinkUrl = selectedLink.url;
        selectedLink.clicks = (selectedLink.clicks || 0) + 1;
        selectedLink.lastUsedAt = new Date().toISOString();
      } else {
        finalSmartlinkUrl = config.defaultSmartlinkUrl || config.popunderUrl || null;
      }
    }

    // Replace dynamic placeholders if present
    if (finalSmartlinkUrl && typeof finalSmartlinkUrl === 'string') {
      finalSmartlinkUrl = finalSmartlinkUrl
        .replace('{video_id}', encodeURIComponent(params.videoId || ''))
        .replace('{category}', encodeURIComponent(params.categoryId || ''))
        .replace('{visitor_id}', encodeURIComponent(visitorId))
        .replace('{timestamp}', Date.now().toString());
    }

    session.lastAdTime = now;

    // Async log click event to Firestore
    logClickEvent({
      visitorId,
      videoId: params.videoId,
      categoryId: params.categoryId,
      smartlinkId: selectedLink?.id,
      smartlinkUrl: finalSmartlinkUrl,
      clickNumber: currentClickNumber,
      interval,
      mode: config.mode,
      timestamp: new Date().toISOString(),
    }).catch(err => console.warn('Failed logging click event to Firestore:', err));
  }

  sessionStore.set(visitorId, session);

  return {
    triggered: shouldTrigger,
    mode: config.mode,
    smartlinkUrl: shouldTrigger ? finalSmartlinkUrl : null,
    clickNumber: currentClickNumber,
    interval: interval,
    cooldownActive: inCooldown,
    rotationStrategy: config.rotationStrategy,
    selectedSmartlinkId: selectedLink?.id,
    selectedSmartlinkName: selectedLink?.name,
  };
}

/**
 * Log click events to Firestore for analytics
 */
async function logClickEvent(data: Record<string, any>) {
  try {
    const clicksCollection = collection(db, 'click_events');
    await addDoc(clicksCollection, data);
  } catch (e) {
    // Ignore error if Firestore is not available
  }
}
