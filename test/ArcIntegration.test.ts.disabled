import { expect } from 'chai';
import axios from 'axios';

describe('AgentStack Arc Integration Service', () => {
  const ARC_URL = 'http://localhost:3000';

  it('should be reachable and return status', async () => {
    const response = await axios.get(`${ARC_URL}/health`);
    expect(response.status).to.equal(200);
    expect(response.data.status).to.equal('ok');
  });

  it('should request payment (402) for unauthenticated requests', async () => {
    try {
      await axios.post(`${ARC_URL}/orchestrate`, {
        prompt: "Get BTC sentiment"
      });
      expect.fail('Should have returned 402');
    } catch (error: any) {
      expect(error.response.status).to.equal(402);
      expect(error.response.headers).to.have.property('x402-payment-request');
      expect(error.response.data).to.have.property('invoiceId');
    }
  });
});
