# SPLIT Allocation System Review

## Issues Found

### 1. ⚠️ Container ID Display Confusion
**Location**: `app/api/containers/allocate-orders/route.ts` line 504

**Problem**: 
- When order is split, `container_id` is set to "latest container" (for backward compatibility)
- In order lists, it shows this container_id, but order is actually split across multiple containers
- This can be misleading - user sees one container but order is split

**Example**:
- Order split across Container A (6 Elena) and Container B (4 Elena)
- `container_id` = Container B (latest)
- Order list shows "Container B" but order is actually split

**Fix Needed**: 
- Show SPLIT badge correctly ✅ (already working)
- Consider showing "SPLIT" instead of container_id when split, or show primary container

### 2. ⚠️ Container Inventory View Shows All Items
**Location**: `app/(admin)/admin/container-inventory/page.tsx` lines 411-428

**Problem**:
- When viewing container orders, split orders show ALL order items
- Should only show items allocated to THIS container
- Currently shows full order, which can be confusing

**Example**:
- Order #1937 split: 6 Elena in Container A, 6 Elena in Container B
- When viewing Container A, shows order with 6 Elena + 6 Draaifunctie (all items)
- Should only show 6 Elena (what's allocated to Container A)

**Fix Needed**: Filter order items to show only items allocated to this container

### 3. ✅ SPLIT Badge Logic - CORRECT
**Location**: `app/api/admin/orders/route.ts` lines 96-101

**Status**: Working correctly
- `container_count` correctly counts unique containers
- Badge shows when `container_count > 1`
- Logic is sound

### 4. ✅ FIFO Rules - MAINTAINED
**Location**: `app/api/containers/allocate-orders/route.ts`

**Status**: FIFO is maintained
- Orders processed by `created_at ASC` (oldest first) ✅
- Containers processed by `eta ASC` (earliest first) ✅
- Split allocations follow same FIFO rules ✅

### 5. ✅ Inventory Calculation - FIXED
**Location**: `app/(admin)/admin/container-inventory/page.tsx`

**Status**: Fixed in previous commit
- Excludes orders with split allocations from old-style counting ✅
- Excludes turn function items ✅
- Split allocations are source of truth ✅

## Recommended Fixes

### Fix 1: Show Only Allocated Items in Container View
**File**: `app/(admin)/admin/container-inventory/page.tsx`

**Change**: Filter order items to show only items allocated to this container

### Fix 2: Improve Container ID Display for Split Orders
**File**: Order display components

**Options**:
- Option A: Show "SPLIT" instead of container_id when split
- Option B: Show primary container (first allocated) with SPLIT badge
- Option C: Show "Multiple" or "SPLIT" text

**Recommendation**: Keep current (shows latest container) but ensure SPLIT badge is always visible

## Testing Checklist

- [ ] Split order shows SPLIT badge correctly
- [ ] Container inventory shows correct allocated quantities
- [ ] Container view shows only items allocated to that container
- [ ] FIFO order is maintained in split allocations
- [ ] No double-counting in inventory
- [ ] No over-allocation
- [ ] Visual consistency across all views

