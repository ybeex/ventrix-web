import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { ApiError, newKey, post } from '../lib/api';
import { enqueue } from '../lib/offline';
import { useToast } from '../lib/toast';
import type { Condition, TxnResult } from '../lib/types';
import { Btn, Field, Modal, Stepper } from './ui';
import { HolderSelect } from './pickers';
import { useSnapshot } from './Snapshot';

export type ActionKind = 'checkin' | 'consume' | 'restock' | 'loss' | 'inspect';
export interface Target { id: string; name: string; itemNumber: string; type: 'asset' | 'consumable'; unit: string; holderId?: string; holderName?: string; quantity?: number }

const TITLES: Record<ActionKind, string> = { checkin: 'Check in', consume: 'Use up', restock: 'Restock', loss: 'Declare lost', inspect: 'Send for inspection' };

// One dialog for the single-item operations. The Idempotency-Key is created once when the dialog
// opens and reused for every retry; it is never regenerated for the same user intent.
export function ItemActionModal({ kind, target, onClose }: { kind: ActionKind; target: Target; onClose: () => void }) {
  const key = useRef(newKey());
  const qc = useQueryClient();
  const { toast, fail } = useToast();
  const [qty, setQty] = useState(target.quantity ?? 1);
  const [cond, setCond] = useState<Condition>('good');
  const [note, setNote] = useState('');
  const [ref, setRef] = useState('');
  const [holder, setHolder] = useState(target.holderId ?? '');
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const snap = useSnapshot(kind === 'inspect' ? 'condition' : kind);
  const isConsumable = target.type === 'consumable';
  const needsNote = kind === 'loss';

  const submit = async () => {
    if (needsNote && !note.trim()) { setErrs({ note: 'Say what happened. A supervisor reviews this.' }); return; }
    if (kind === 'consume' && !holder) { setErrs({ holder: 'Choose who used it.' }); return; }
    if (snap.blockedOffline) { setErrs({ _: 'A photo is required, so this cannot be saved offline.' }); return; }
    setBusy(true); setErrs({});
    try {
      const itemId = target.id;
      let path = '', body: Record<string, unknown> = { itemId };
      if (kind === 'checkin') { path = '/transactions/checkin'; body = { itemId, ...(isConsumable ? {} : { condition: cond }), ...(holder ? { holderId: holder } : {}), ...(isConsumable ? { quantity: qty } : {}), ...(note ? { note } : {}) }; }
      if (kind === 'consume') { path = '/transactions/consume'; body = { itemId, quantity: qty, holderId: holder, ...(note ? { note } : {}) }; }
      if (kind === 'restock') { path = '/transactions/restock'; body = { itemId, quantity: qty, ...(ref ? { reference: ref } : {}), ...(note ? { note } : {}) }; }
      if (kind === 'loss') { path = '/transactions/loss'; body = { itemId, note, ...(target.holderId ? { holderId: target.holderId } : {}), ...(isConsumable ? { quantity: qty } : {}) }; }
      if (kind === 'inspect') { path = '/transactions/condition'; body = { itemId, toState: 'under_repair', condition: 'needs_inspection', ...(note ? { note } : {}) }; }
      if (!navigator.onLine) {
        // Offline: save on this device and replay through /sync/batch when the connection returns.
        const type = kind === 'inspect' ? 'condition' : kind === 'loss' ? 'loss' : kind;
        enqueue(type, body, `${TITLES[kind]}: ${target.name}`);
        toast(`Saved on this device. ${TITLES[kind]} for ${target.name} will sync when you are back online.`);
        onClose();
        return;
      }
      const snapshotFileId = await snap.send();
      if (snapshotFileId) body = { ...body, snapshotFileId };
      const { data, status } = await post<TxnResult>(path, body, key.current);
      toast(data.status === 'pending_approval' ? 'Sent for approval. Nothing has moved yet.' : `${TITLES[kind]} recorded for ${target.name}${status === 200 ? ' (already saved)' : ''}`);
      await qc.invalidateQueries();
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'VALIDATION_ERROR') setErrs(e.fieldErrors());
      fail(e);
    } finally { setBusy(false); }
  };

  return (
    <Modal title={`${TITLES[kind]}: ${target.name}`} onClose={onClose}>
      <span className="mono">{target.itemNumber}{target.holderName ? ` · held by ${target.holderName}` : ''}</span>
      {kind === 'loss' && <p className="muted">This adds a loss record{target.holderName ? ` against ${target.holderName}` : ''}. The checkout stays in history, and a supervisor may need to approve it.</p>}
      {(kind === 'consume' || (kind === 'checkin' && !target.holderId)) && <HolderSelect value={holder} onChange={setHolder} label={kind === 'consume' ? 'Who used it?' : 'Who is returning it?'} />}
      {errs.holder && <span className="errmsg">{errs.holder}</span>}
      {isConsumable && kind !== 'inspect' && <div className="field">Quantity ({target.unit})<Stepper value={qty} onChange={setQty} /></div>}
      {kind === 'checkin' && !isConsumable && (
        <Field label="Condition"><select value={cond} onChange={(e) => setCond(e.target.value as Condition)}><option value="good">Good</option><option value="needs_inspection">Needs inspection</option><option value="damaged">Damaged</option></select></Field>
      )}
      {kind === 'restock' && <Field label="Delivery note or PO (optional)"><input value={ref} onChange={(e) => setRef(e.target.value)} /></Field>}
      <Field label={needsNote ? 'What happened' : 'Note (optional)'} error={errs.note}><input value={note} onChange={(e) => setNote(e.target.value)} placeholder={needsNote ? 'Last seen on level 3, Block C' : ''} /></Field>
      {snap.field}
      {errs._ && <span className="errmsg" role="alert">{errs._}</span>}
      <div className="row-flex" style={{ justifyContent: 'flex-end' }}>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn className={kind === 'loss' ? 'danger' : 'primary'} busy={busy} onClick={submit}>{TITLES[kind]}</Btn>
      </div>
    </Modal>
  );
}
