const expected = 'cross-env-ok';

if (process.env.EMUCFG_VERIFY_CROSS_ENV !== expected) {
  console.error('cross-env failed to propagate environment variable');
  process.exit(1);
}

console.log('cross-env OK:', process.env.EMUCFG_VERIFY_CROSS_ENV);
