# Data Isolation & Consistency Bug Fixes (Frontend)
**Date**: September 21, 2026
**Author**: Michael

## Overview
This document logs the frontend fixes related to Retur / Adjustments.

## Changes Made

### 1. Retur & Adjustment Fixes (Double Deduction)
- **Problem**: When a user returned physical items (Retur), the system reduced `qty_ordered`, automatically reducing the invoice `subtotal`. However, the generated PDF still manually subtracted the returned quantity again using a "(Retur)" deduction row, causing the numbers to not match.
- **Fix**: Removed the manual ">(Retur)" deduction rows in `pdfGenerator.ts` because the main item line now simply reflects the net post-return quantity.
