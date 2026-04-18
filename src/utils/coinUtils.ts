interface TaxBracket {
    maxAmount: number;
    taxRate: number;
}

const TRANSFER_TAX_BRACKETS: TaxBracket[] = [
    { maxAmount: 1000, taxRate: 0.02 }, // 2% for transfers up to 1000 coins
    { maxAmount: 2000, taxRate: 0.05 }, // 5% for transfers between 1001-2000 coins
    { maxAmount: 5000, taxRate: 0.08 }, // 8% for transfers between 2001-5000 coins
    { maxAmount: 10000, taxRate: 0.12 }, // 12% for transfers between 5001-10000 coins
    { maxAmount: Infinity, taxRate: 0.15 } // 15% for transfers above 10000 coins
];

const DEBT_INTEREST_RATE = 0.1; // 10% interest on negative balance when going more negative

export function calculateTransferTax(amount: number): { taxAmount: number; finalAmount: number } {
    // Find the appropriate tax bracket
    const bracket = TRANSFER_TAX_BRACKETS.find(b => amount <= b.maxAmount);
    if (!bracket) return { taxAmount: 0, finalAmount: amount }; // Shouldn't happen due to Infinity bracket

    const taxAmount = Math.floor(amount * bracket.taxRate);
    const finalAmount = amount - taxAmount;

    return { taxAmount, finalAmount };
}

export function calculateDebtInterest(currentBalance: number, deductionAmount: number): number {
    if (currentBalance >= 0 || deductionAmount <= 0) return deductionAmount;
    
    // If already in debt and going more negative, apply compound interest
    const interestMultiplier = 1 + DEBT_INTEREST_RATE;
    return Math.floor(deductionAmount * interestMultiplier);
}