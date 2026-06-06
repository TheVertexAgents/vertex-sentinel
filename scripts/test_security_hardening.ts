import { io } from 'socket.io-client';
import axios from 'axios';

const PORT = 3006;
const BASE_URL = `http://localhost:${PORT}`;

async function testRateLimits() {
    console.log('Testing general API rate limit (100/min)...');
    for (let i = 0; i < 5; i++) {
        try {
            const res = await axios.get(`${BASE_URL}/api/health`);
            console.log(`Request ${i + 1}: ${res.status}`);
        } catch (e: any) {
            console.log(`Request ${i + 1} failed: ${e.response?.status}`);
        }
    }

    console.log('\nTesting toggle API rate limit (10/min)...');
    for (let i = 0; i < 12; i++) {
        try {
            const res = await axios.post(`${BASE_URL}/api/automation/toggle`, { enabled: true });
            console.log(`Toggle ${i + 1}: ${res.status}`);
        } catch (e: any) {
            if (e.response?.status === 429) {
                console.log(`Toggle ${i + 1}: 429 Too Many Requests (Correct)`);
                break;
            } else {
                console.log(`Toggle ${i + 1} failed: ${e.response?.status}`);
            }
        }
    }
}

async function testSocketThrottle() {
    console.log('\nTesting Socket.io connection throttle (max 5)...');
    const sockets = [];
    for (let i = 0; i < 7; i++) {
        const socket = io(BASE_URL, { forceNew: true });

        const promise = new Promise((resolve) => {
            socket.on('connect', () => {
                console.log(`Socket ${i + 1} connected`);
                resolve(true);
            });
            socket.on('connect_error', (err) => {
                console.log(`Socket ${i + 1} connection error: ${err.message}`);
                resolve(false);
            });
        });

        sockets.push(socket);
        const success = await promise;
        if (!success) break;
    }

    sockets.forEach(s => s.disconnect());
}

async function runTests() {
    await testRateLimits();
    await testSocketThrottle();
}

runTests().catch(console.error);
