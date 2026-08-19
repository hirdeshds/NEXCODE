import * as path from "path";
import Mocha from "mocha";
import * as fs from "fs";

export function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: "tdd",
    color: true,
    timeout: 20000,
  });

  const testsRoot = path.resolve(__dirname, "..");

  return new Promise((c, e) => {
    try {
      const suiteDir = path.join(testsRoot, "suite");
      const files = fs.readdirSync(suiteDir);
      const testFiles = files.filter((f) => f.endsWith(".test.js"));

      // Add files to the test suite
      testFiles.forEach((f) => mocha.addFile(path.resolve(suiteDir, f)));

      // Run the mocha test
      mocha.run((failures) => {
        if (failures > 0) {
          e(new Error(`${failures} tests failed.`));
        } else {
          c();
        }
      });
    } catch (err) {
      e(err);
    }
  });
}
