# Inventory Issues Diagnosis

## Problems Reported by Owner

### Problem 1: Inventory Mismatch
**Issue**: Tool shows less stock than Shopify after 1 week
- Owner manually sets first container stock to match Shopify
- After orders come in, both should decrease by same amount
- But tool shows less stock than Shopify

**Root Cause Analysis**:
1. **Possible Causes**:
   - Orders allocated but not properly deducted from inventory
   - Refund/reallocation not updating inventory correctly
   - Turn function items being counted incorrectly
   - Split allocations not being counted properly
   - Orders deleted/refunded but inventory not restored

2. **Investigation Needed**:
   - Check if refund webhook properly restores inventory
   - Check if order deletion properly updates inventory
   - Verify allocated quantities calculation includes all order items
   - Check if turn function exclusion is working correctly

### Problem 2: Container 9 Display Mismatch
**Issue**: Container 9 shows "24 products linked" but clicking shows only 2 orders with 6x Elena each = 12 products

**Root Cause Analysis**:
1. **Possible Causes**:
   - Turn function items (draaifunctie) being counted in summary
   - Split allocations being double-counted
   - Summary count includes items from other containers
   - Display logic counting all order items instead of just allocated products

2. **Investigation Needed**:
   - Check how "24 products" count is calculated
   - Verify if turn function items are included
   - Check if split allocations are counted correctly
   - Compare summary calculation vs detail view calculation

## Code Analysis

### Inventory Calculation (container-inventory/page.tsx)

**Lines 167-200**: Allocated quantities calculation
```typescript
// Calculate allocated quantities per product from old-style linked orders
const allocated: Record<string, number> = {}
containerOrderItems.forEach((item: any) => {
  const productId = item.product_id
  if (productId) {
    allocated[productId] = (allocated[productId] || 0) + (item.quantity || 1)
  } else {
    // If no product_id, try to match by name
    const product = containerProds.find((cp: any) => 
      cp.product?.name?.toLowerCase() === item.name?.toLowerCase()
    )
    if (product) {
      allocated[product.product_id] = (allocated[product.product_id] || 0) + (item.quantity || 1)
    }
  }
})

// Add split allocations for this container
if (splitAllocations) {
  splitAllocations.forEach((alloc: any) => {
    if (alloc.container_id === container.id) {
      // Find product by normalized name
      const normalizedName = alloc.product_name.toLowerCase().trim().replace(/\s+/g, ' ')
      const product = containerProds.find((cp: any) => {
        const cpName = cp.product?.name?.toLowerCase().trim().replace(/\s+/g, ' ')
        return cpName === normalizedName
      })
      
      if (product && product.product_id) {
        allocated[product.product_id] = (allocated[product.product_id] || 0) + (alloc.quantity || 0)
      }
    }
  })
}
```

**⚠️ ISSUE FOUND**: This code does NOT exclude turn function items!

**Lines 169-182**: Counts ALL order items, including turn function
- Should exclude items with "draaifunctie" or "turn function" in name
- Currently counts everything

### Allocation Logic (allocate-orders/route.ts)

**Lines 264-268**: Correctly excludes turn function when deducting
```typescript
if (productName && !productName.includes('draaifunctie') && !productName.includes('turn function')) {
  const itemQty = item.quantity || 1
  requiredProducts[productName] = (requiredProducts[productName] || 0) + itemQty
}
```

**✅ CORRECT**: Allocation logic excludes turn function

### Refund/Reallocation (webhooks/shopify-refund/route.ts)

**Lines 315-361**: Reallocation after deletion
- Only shifts orders up, doesn't restore inventory
- **⚠️ ISSUE**: When order is deleted, inventory should be restored but it's not explicitly done

**Lines 141-170**: Full refund handling
- Deletes order
- Calls reallocateOrdersAfterDeletion
- **⚠️ ISSUE**: No explicit inventory restoration

## Root Causes Identified

### 1. Turn Function Items Being Counted in Display
**Location**: `app/(admin)/admin/container-inventory/page.tsx` lines 169-182

**Problem**: When calculating allocated quantities for display, turn function items are included

**Fix Needed**: Exclude turn function items when counting allocated quantities

### 2. Refund/Deletion Not Restoring Inventory
**Location**: `app/api/webhooks/shopify-refund/route.ts`

**Problem**: When orders are deleted/refunded, inventory is not explicitly restored

**Fix Needed**: When order is deleted, restore inventory quantities

### 3. Inventory Calculation Inconsistency
**Location**: Multiple files

**Problem**: 
- Allocation logic excludes turn function ✅
- Display logic includes turn function ❌
- This causes mismatch between what's allocated and what's displayed

## Recommended Fixes

### Fix 1: Exclude Turn Function from Display Count
**File**: `app/(admin)/admin/container-inventory/page.tsx`

**Change**: Filter out turn function items when calculating allocated quantities

```typescript
// Current (line 169-182)
containerOrderItems.forEach((item: any) => {
  const productId = item.product_id
  if (productId) {
    allocated[productId] = (allocated[productId] || 0) + (item.quantity || 1)
  }
  // ...
})

// Fixed
containerOrderItems.forEach((item: any) => {
  // Exclude turn function items
  const itemName = item.name?.toLowerCase() || ''
  if (itemName.includes('draaifunctie') || itemName.includes('turn function')) {
    return // Skip turn function items
  }
  
  const productId = item.product_id
  if (productId) {
    allocated[productId] = (allocated[productId] || 0) + (item.quantity || 1)
  }
  // ...
})
```

### Fix 2: Restore Inventory on Order Deletion
**File**: `app/api/webhooks/shopify-refund/route.ts`

**Change**: When order is deleted, restore inventory quantities

### Fix 3: Verify Split Allocations Count
**File**: `app/(admin)/admin/container-inventory/page.tsx`

**Change**: Ensure split allocations are counted correctly and not double-counted

## Testing Plan

1. **Test Turn Function Exclusion**:
   - Create order with Elena + draaifunctie
   - Allocate to container
   - Check display - should show only Elena allocated, not draaifunctie

2. **Test Refund Inventory Restoration**:
   - Allocate order to container
   - Note allocated quantity
   - Refund order in Shopify
   - Check inventory - should restore allocated quantity

3. **Test Container 9 Display**:
   - Check Container 9 summary count
   - Click to see detail view
   - Counts should match (excluding turn function)

