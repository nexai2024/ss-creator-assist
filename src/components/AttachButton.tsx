import { Paperclip } from 'lucide-react';
import { useRef, type ChangeEvent } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

export function AttachButton({
  tenantId,
  entityType,
  entityId,
}: {
  tenantId: string;
  entityType: 'ticket' | 'chat';
  entityId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadUrl = useMutation(api.attachments.generateUploadUrl);
  const save = useMutation(api.attachments.save);

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const url = await uploadUrl({ tenantId: tenantId as Id<'tenants'> });
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
    const { storageId } = await res.json() as { storageId: Id<'_storage'> };
    await save({
      tenantId: tenantId as Id<'tenants'>,
      entityType,
      entityId,
      storageId,
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
    });
  };

  return (
    <>
      <input ref={inputRef} type="file" className="hidden" onChange={(e) => void onPick(e)} />
      <button type="button" className="btn-secondary self-end" title="Attach file" onClick={() => inputRef.current?.click()}>
        <Paperclip className="w-4 h-4" />
      </button>
    </>
  );
}

export function AttachmentList({
  tenantId,
  entityType,
  entityId,
}: {
  tenantId: string;
  entityType: 'ticket' | 'chat';
  entityId: string;
}) {
  const rows = useQuery(api.attachments.list, {
    tenantId: tenantId as Id<'tenants'>,
    entityType,
    entityId,
  });
  if (!rows?.length) return null;
  return (
    <div className="flex flex-wrap gap-2 px-1 pb-2">
      {rows.map((file) => (
        <a
          key={file.id}
          href={file.url ?? '#'}
          target="_blank"
          rel="noreferrer"
          className="text-xs px-2 py-1 rounded-md bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
        >
          {file.file_name}
        </a>
      ))}
    </div>
  );
}
