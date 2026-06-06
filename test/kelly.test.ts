import { expect } from 'chai';
import { KellyCriterion } from '../src/logic/sizing/kelly.js';

describe('KellyCriterion', () => {
    it('should calculate full Kelly correctly', () => {
        // winRate = 0.6, avgWin = 20, avgLoss = 10
        // b = 20/10 = 2
        // f = 0.6 - (0.4 / 2) = 0.6 - 0.2 = 0.4
        const f = KellyCriterion.calculate(0.6, 20, 10);
        expect(f).to.be.closeTo(0.4, 0.001);
    });

    it('should calculate fractional Kelly correctly', () => {
        const f = KellyCriterion.getFractionalSize(0.6, 20, 10, 0.25);
        expect(f).to.be.closeTo(0.1, 0.001);
    });

    it('should return 0 for zero win rate', () => {
        const f = KellyCriterion.calculate(0, 20, 10);
        expect(f).to.equal(0);
    });

    it('should return 0 for negative edge', () => {
        // winRate = 0.3, b = 2
        // f = 0.3 - (0.7 / 2) = 0.3 - 0.35 = -0.05 -> 0
        const f = KellyCriterion.calculate(0.3, 20, 10);
        expect(f).to.equal(0);
    });

    it('should handle zero loss (infinite edge)', () => {
        const f = KellyCriterion.calculate(0.6, 20, 0);
        expect(f).to.equal(1);
    });
});
