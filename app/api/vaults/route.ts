import { NextRequest, NextResponse } from 'next/server';
import { getVaults, addVault, getFiles, getConfigMap, addLog } from '@/lib/excel-db';
import { createForumTopic } from '@/lib/telegram';

export async function GET() {
  try {
    const vaults = await getVaults();
    const files = await getFiles();

    // Calculate stats per vault
    const vaultsWithStats = vaults.map((vault) => {
      const vaultFiles = files.filter((f) => (f.vault_id || 'vault_general') === vault.id);
      const totalSize = vaultFiles.reduce((sum, f) => sum + (f.size || 0), 0);
      return {
        ...vault,
        fileCount: vaultFiles.length,
        totalSize,
      };
    });

    return NextResponse.json({
      ok: true,
      vaults: vaultsWithStats,
      totalFiles: files.length,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, icon, color, description, is_private, create_telegram_topic } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ ok: false, message: 'Nama Vault wajib diisi' }, { status: 400 });
    }

    let topicId = body.topic_id || '';

    // Automatically create Forum Topic in Telegram if requested and token is configured
    if (create_telegram_topic) {
      const config = await getConfigMap();
      if (config.telegram_bot_token && config.telegram_chat_id) {
        const tgRes = await createForumTopic(config.telegram_bot_token, config.telegram_chat_id, `📁 ${name.trim()}`);
        if (tgRes.ok && tgRes.message_thread_id) {
          topicId = String(tgRes.message_thread_id);
        }
      }
    }

    const newVault = await addVault({
      name: name.trim(),
      topic_id: topicId,
      icon: icon || 'Folder',
      color: color || 'amber',
      description: description || '',
      is_private: !!is_private,
    });

    await addLog('VAULT_CREATE', name, 'SUCCESS');

    return NextResponse.json({
      ok: true,
      message: `Vault Topic "${newVault.name}" berhasil dibuat!`,
      vault: newVault,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message || 'Gagal membuat vault' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vaultId = searchParams.get('id') || searchParams.get('vault_id');
    const body = await req.json().catch(() => ({}));
    const targetId = vaultId || body.id || body.vault_id;

    if (!targetId) {
      return NextResponse.json({ ok: false, message: 'Vault ID wajib disertakan' }, { status: 400 });
    }

    const { deleteVault } = await import('@/lib/excel-db');
    const success = await deleteVault(targetId);

    if (success) {
      await addLog('VAULT_DELETE', targetId, 'SUCCESS');
      return NextResponse.json({ ok: true, message: 'Kategori Topic berhasil dihapus!' });
    } else {
      return NextResponse.json({ ok: false, message: 'Kategori Vault tidak ditemukan' }, { status: 404 });
    }
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message || 'Gagal menghapus vault' }, { status: 500 });
  }
}

