const { getCategory } = require("../tools/get_category");

const tests = [
  { app: "Microsoft Edge", title: "Coldplay - Yellow (Official Video) - YouTube - Personal - Microsoft Edge", expected: "MUSIC" },
  { app: "msedge", title: "Radwimps - Sparkle - YouTube - Microsoft Edge", expected: "MUSIC" },
  { app: "msedge", title: "Lofi Hip Hop Radio - Beats to Relax - YouTube - Microsoft Edge", expected: "MUSIC" },
  { app: "Google Chrome", title: "JavaScript Tutorial for Beginners - YouTube - Google Chrome", expected: "LEARNING" },
  { app: "msedge", title: "vlog liburan ke jepang - YouTube - Microsoft Edge", expected: "NONTON" },
  { app: "Microsoft Edge", title: "facebook/react: The library for web - GitHub - Microsoft Edge", expected: "CODING" },
  { app: "msedge", title: "How to fix null pointer in JavaScript - Stack Overflow - Microsoft Edge", expected: "CODING" },
  { app: "msedge", title: "Mio Dashboard - localhost:5173 - Microsoft Edge", expected: "CODING" },
  { app: "msedge", title: "(14) WhatsApp - Microsoft Edge", expected: "COMMUNICATION" },
  { app: "msedge", title: "Ethol Politeknik Elektronika Negeri Surabaya - Microsoft Edge", expected: "ACADEMIC" },
  { app: "Antigravity IDE", title: "web - Antigravity IDE - Dashboard.jsx", expected: "CODING" },
  { app: "Spotify", title: "Spotify Premium", expected: "MUSIC" },
  { app: "Wuthering Waves", title: "Wuthering Waves", expected: "GAMING" }
];

let failed = 0;
tests.forEach((t, idx) => {
  const actual = getCategory(t.app, t.title);
  if (actual !== t.expected) {
    console.error(`FAIL [${idx}]: app='${t.app}', title='${t.title}' -> Got '${actual}', Expected '${t.expected}'`);
    failed++;
  } else {
    console.log(`PASS [${idx}]: ${t.expected.padEnd(14)} -> ${t.title.slice(0, 48)}...`);
  }
});

if (failed > 0) {
  console.error(`\nFAILED: ${failed} tests failed.`);
  process.exit(1);
} else {
  console.log(`\nSUCCESS: ALL ${tests.length} CLASSIFIER TESTS PASSED 100%!`);
  process.exit(0);
}
