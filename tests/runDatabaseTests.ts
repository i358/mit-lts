/**
 * Test Runner - Tüm Database Instance Testlerini Çalıştırır
 * Bu dosya ile tüm test senaryolarını toplu olarak çalıştırabilirsiniz
 */

import { runAllPostgresTests } from './postgresInstanceTest';
import { runAllRedisTests } from './redisInstanceTest';
import { runAllIntegrationTests } from './databaseIntegrationTest';

// Test suite seçenekleri
interface TestOptions {
    postgres?: boolean;
    redis?: boolean;
    integration?: boolean;
    all?: boolean;
}

async function runDatabaseTests(options: TestOptions = { all: true }) {
    console.log('🚀 HabboTOH Database Instance Test Suite\n');
    console.log('Starting comprehensive database testing...\n');
    
    const startTime = Date.now();

    try {
        if (options.all || options.postgres) {
            console.log('🐘 Running PostgreSQL Tests...');
            await runAllPostgresTests();
            console.log('\n');
        }

        if (options.all || options.redis) {
            console.log('🔴 Running Redis Tests...');
            await runAllRedisTests();
            console.log('\n');
        }

        if (options.all || options.integration) {
            console.log('🔗 Running Integration Tests...');
            await runAllIntegrationTests();
            console.log('\n');
        }

        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;

        console.log('=' .repeat(70));
        console.log('🎉 All Database Tests Completed Successfully!');
        console.log(`⏱️ Total execution time: ${duration.toFixed(2)} seconds`);
        console.log('=' .repeat(70));

    } catch (error) {
        console.error('❌ Test suite failed:', error);
        process.exit(1);
    }
}

// CLI argümanlarını parse et
function parseArguments(): TestOptions {
    const args = process.argv.slice(2);
    const options: TestOptions = {};

    if (args.includes('--postgres')) options.postgres = true;
    if (args.includes('--redis')) options.redis = true;
    if (args.includes('--integration')) options.integration = true;
    if (args.length === 0 || args.includes('--all')) options.all = true;

    return options;
}

// Yardım mesajı
function showHelp() {
    console.log(`
🧪 HabboTOH Database Test Runner

Usage:
  npm run test:db [options]

Options:
  --postgres      Run only PostgreSQL tests
  --redis         Run only Redis tests  
  --integration   Run only integration tests
  --all           Run all tests (default)
  --help          Show this help message

Examples:
  npm run test:db                    # Run all tests
  npm run test:db --postgres         # Run only PostgreSQL tests
  npm run test:db --redis            # Run only Redis tests
  npm run test:db --integration      # Run only integration tests

Environment Requirements:
  - Docker containers must be running (postgres, redis)
  - .env file must be configured with database credentials
  - Database instance utilities must be properly initialized

Test Coverage:
  📊 PostgreSQL: CRUD operations, connections, error handling
  📊 Redis: Key-value operations, indexes, performance
  📊 Integration: Cross-database operations, transactions
`);
}

// Ana fonksiyon
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
        return;
    }

    const options = parseArguments();
    await runDatabaseTests(options);
}

// Package.json script olarak çalıştırıldığında
if (require.main === module) {
    main().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

export { runDatabaseTests, parseArguments };
