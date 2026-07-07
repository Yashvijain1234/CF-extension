/**
 * Language configuration shared across the editor, submission service and
 * GitHub uploader.
 *
 * `cfId` is Codeforces' internal `programTypeId` used by the submit form.
 * These IDs occasionally change; they are centralized here for easy updates.
 */

export const LANGUAGES = {
  cpp: {
    id: 'cpp',
    label: 'C++ (GNU G++23)',
    monaco: 'cpp',
    ext: 'cpp',
    cfId: '89',
    template: `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n\n    return 0;\n}\n`,
  },
  java: {
    id: 'java',
    label: 'Java 21',
    monaco: 'java',
    ext: 'java',
    cfId: '87',
    template: `import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) throws IOException {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n\n    }\n}\n`,
  },
  python: {
    id: 'python',
    label: 'Python 3',
    monaco: 'python',
    ext: 'py',
    cfId: '31',
    template: `import sys\ninput = sys.stdin.readline\n\ndef main():\n    pass\n\nif __name__ == "__main__":\n    main()\n`,
  },
  kotlin: {
    id: 'kotlin',
    label: 'Kotlin 1.9',
    monaco: 'kotlin',
    ext: 'kt',
    cfId: '88',
    template: `import java.io.BufferedReader\nimport java.io.InputStreamReader\n\nfun main() {\n    val br = BufferedReader(InputStreamReader(System.\`in\`))\n\n}\n`,
  },
  rust: {
    id: 'rust',
    label: 'Rust 1.75',
    monaco: 'rust',
    ext: 'rs',
    cfId: '75',
    template: `use std::io::{self, Read, Write};\n\nfn main() {\n    let mut input = String::new();\n    io::stdin().read_to_string(&mut input).unwrap();\n    let stdout = io::stdout();\n    let mut out = io::BufWriter::new(stdout.lock());\n    let _ = &mut out;\n}\n`,
  },
  go: {
    id: 'go',
    label: 'Go 1.22',
    monaco: 'go',
    ext: 'go',
    cfId: '32',
    template: `package main\n\nimport (\n\t"bufio"\n\t"fmt"\n\t"os"\n)\n\nfunc main() {\n\treader := bufio.NewReader(os.Stdin)\n\twriter := bufio.NewWriter(os.Stdout)\n\tdefer writer.Flush()\n\t_ = reader\n\t_ = fmt.Sprint\n}\n`,
  },
  javascript: {
    id: 'javascript',
    label: 'JavaScript (Node.js)',
    monaco: 'javascript',
    ext: 'js',
    cfId: '55',
    template: `const data = require('fs').readFileSync(0, 'utf8');\nconst lines = data.split('\\n');\nlet idx = 0;\nconst next = () => lines[idx++];\n\nfunction main() {\n\n}\n\nmain();\n`,
  },
  csharp: {
    id: 'csharp',
    label: 'C# 12 (.NET)',
    monaco: 'csharp',
    ext: 'cs',
    cfId: '79',
    template: `using System;\nusing System.IO;\n\nclass Program {\n    static void Main() {\n        var input = new StreamReader(Console.OpenStandardInput());\n\n    }\n}\n`,
  },
};

export const LANGUAGE_LIST = Object.values(LANGUAGES);

export function getLanguageByExt(ext) {
  return LANGUAGE_LIST.find((l) => l.ext === ext);
}
