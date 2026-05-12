import '../src/bootstrap.js';
import { ai } from '../src/utils/ai.js';
import { logger } from '../src/utils/logger.js';
import { llama33x70bVersatile } from 'genkitx-groq';

async function testResolution() {
  logger.info({ step: 'TEST_START', message: 'Verifying Genkit model registration...' });

  // Wait a moment for async plugin registration if necessary
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  try {
    const result = await ai.generate({
      model: llama33x70bVersatile,
      prompt: 'Verify system integrity. Respond with SUCCESS.'
    });
    
    console.log('\n✅ GROQ RESOLUTION SUCCESSFUL');
    console.log('Response:', result.text);
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ GROQ RESOLUTION FAILED');
    console.error('Error:', err.message);
    
    if (err.message.includes('not found')) {
      console.error('\nPossible cause: Plugin registration timing or model naming mismatch.');
    }
    process.exit(1);
  }
}

testResolution().catch(err => {
  console.error('Fatal error in test script:', err);
  process.exit(1);
});
