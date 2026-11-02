export type Role = 'admin' | 'supervisor' | 'store_staff' | 'viewer';
export type DueStatus = 'on_time' | 'due_soon' | 'overdue' | null;
export type AssetState = 'available' | 'checked_out' | 'lost' | 'damaged' | 'under_repair' | 'retired' | null;
export type Condition = 'good' | 'damaged' | 'needs_inspection' | 'replaced';

export interface Me {
  id: string; email: string; role: Role; orgId: string; sessionKind: 'primary' | 'pin'; trustedDevice: boolean; hasPin: boolean;
  organization: { name: string; slug: string; timezone: string };
  settings: { staffCanManageItems: boolean; requirePhotoFor: string[] };
}
export interface Page<T> { items: T[]; nextCursor: string | null }
export interface Dashboard {
  lowStock: number; nearMinimum: number; outstanding: number; overdue: number; dueSoon: number; todayTransactions: number;
  openDiscrepancies: number; pendingApprovals: number; openSyncIssues: number; activeItems: number; timezone: string; generatedAt: string;
}
export interface ItemRef { id: string; itemNumber: string; name: string; type: 'asset' | 'consumable'; unit: string }
export interface HolderRef { id: string; name: string; kind: string }
export interface OutstandingRow {
  item: ItemRef; holder: HolderRef; quantity: number; issuedQuantity: number; returnedQuantity: number; partialReturn: boolean;
  since: string | null; dueAt: string | null; jobId: string | null; dueStatus: DueStatus; overdueByHours: number | null;
}
export interface LowStockRow {
  item: { id: string; itemNumber: string; name: string; unit: string; categoryName: string | null };
  quantity: number; minimum: number; shortfall: number; headroom: number; status: 'low' | 'near'; outOfStock: boolean; reorderQuantity: number | null;
}
export interface Item {
  id: string; itemNumber: string; type: 'asset' | 'consumable'; sku: string | null; code: string; name: string; description: string | null;
  categoryId: string; categoryName: string | null; shelfId: string | null; shelfName: string | null; photoFileId: string | null; unit: string;
  assetState: AssetState; condition: Condition | null; currentHolder: { id: string; name: string } | null; currentJobId: string | null;
  checkedOutAt: string | null; dueAt: string | null; dueStatus: DueStatus; quantityAvailable: number | null; minQuantity: number | null;
  effectiveMinQuantity: number | null; reorderQuantity: number | null; lowStock: boolean; nearMinimum: boolean; archivedAt: string | null;
}
export interface Holder { id: string; kind: 'person' | 'team' | 'department' | 'job_site' | 'other'; name: string; code: string | null }
export interface Stats { assets: number; products: number; units: number; checkedOut: number; underRepair: number; damaged: number; lost: number; lowStock: number; nearMinimum: number; overdue: number }
export interface CollectionShelf {
  id: string; name: string; code: string; stats: Stats; attention: string[];
  categories: { id: string; name: string; itemCount: number; stats: Stats; attention: string[] }[];
}
export interface Txn {
  id: string; sequence: number; summary: string; type: string; itemId: string; itemNumber?: string; itemName?: string; quantity?: number;
  actor: { id: string; name?: string }; holder?: { id: string; name: string }; stateBefore?: AssetState; stateAfter?: AssetState;
  condition?: Condition | null; note?: string | null; occurredAt: string; createdAt: string;
}
export interface Approval {
  id: string; operation: string; status: 'pending' | 'approved' | 'rejected' | 'cancelled'; item: { id: string; name: string; itemNumber: string };
  request: unknown; requestedBy: { id: string; name?: string }; reviewedBy?: { id: string; name?: string } | null; reviewNote?: string | null; createdAt: string;
}
export interface ActivityRow { id: string; sequence: number; action: string; label: string; category: string; summary: string; actor: { id: string; name?: string }; createdAt: string }
export type Committed = { status: 'committed'; transaction: Txn; transactions?: Txn[] };
export type Pending = { status: 'pending_approval'; approval: Approval };
export type TxnResult = Committed | Pending;

export interface Shelf { id: string; name: string; code: string; itemCount: number; categoryCount: number; cycleCountDays: number; lastCountedAt: string | null; nextCountDueAt: string | null }
export interface Recon { id: string; scope: string; scopeId: string; status: 'open' | 'closed'; note?: string | null; startedAt: string; closedAt?: string | null }
export interface ExpectedRow { itemId: string; itemNumber: string; name: string; type: 'asset' | 'consumable'; unit: string; systemQuantity: number; counted: boolean }
export interface CountRow { id: string; itemId: string; itemNumber: string; itemName: string; systemQuantity: number; physicalQuantity: number; variance: number; reason?: string | null; resolution: 'matched' | 'adjusted' | 'pending_approval' | 'rejected' | 'unresolved' }
export interface Notice { id: string; type: string; title: string; body: string; entityType?: string | null; entityId?: string | null; read: boolean; createdAt: string }
