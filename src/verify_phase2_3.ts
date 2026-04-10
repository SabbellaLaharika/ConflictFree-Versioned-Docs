import axios from 'axios';

const BASE_URL = 'http://localhost:3000/api';

async function test() {
  try {
    console.log('--- Phase 2: Create ---');
    const createRes = await axios.post(`${BASE_URL}/documents`, {
      title: 'Auto Test Doc',
      content: 'Initial content',
      tags: ['test'],
      authorName: 'Tester',
      authorEmail: 'tester@example.com'
    });
    const doc = createRes.data;
    console.log('Created:', doc.slug, 'Version:', doc.version);

    console.log('--- Phase 3: Update OK ---');
    const updateRes = await axios.put(`${BASE_URL}/documents/${doc.slug}`, {
      title: 'Updated Title',
      content: 'New content',
      version: 1
    });
    console.log('Updated to Version:', updateRes.data.version);

    console.log('--- Phase 3: Update Conflict (409) ---');
    try {
      await axios.put(`${BASE_URL}/documents/${doc.slug}`, {
        title: 'Conflicting Title',
        content: 'Old content',
        version: 1 // Still using version 1
      });
    } catch (err: any) {
      if (err.response && err.response.status === 409) {
        console.log('Successfully caught 409 conflict');
      } else {
        throw err;
      }
    }

    console.log('--- Final check ---');
    const finalGet = await axios.get(`${BASE_URL}/documents/${doc.slug}`);
    console.log('Final Version:', finalGet.data.version);
    console.log('Revision History Count:', finalGet.data.revision_history.length);

    console.log('\n--- ALL TESTS PASSED ---');
  } catch (error: any) {
    console.error('Test failed:', error.message);
    if (error.response) console.error('Data:', error.response.data);
    process.exit(1);
  }
}

test();
