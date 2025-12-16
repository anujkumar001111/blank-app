import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import copy from 'rollup-plugin-copy';

const external = [
  "@eko-ai/eko",
  "@eko-ai/eko/types",
  "electron",
  "glob",
  "fs",
  "fs/promises",
  "path",
  "child_process"
];

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.cjs.js',
        format: 'cjs',
        sourcemap: true
      }
    ],
    external,
    plugins: [
      json(),
      commonjs(),
      resolve({
        preferBuiltins: true,
      }),
      typescript(),
      copy({
        targets: [
          { src: '../../LICENSE', dest: 'dist/' },
          { src: './README.md', dest: 'dist/' }
        ]
      })
    ]
  },
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.esm.js',
        format: 'esm',
        sourcemap: true
      }
    ],
    external,
    plugins: [
      json(),
      commonjs(),
      resolve({
        preferBuiltins: true,
      }),
      typescript(),
      copy({
        targets: [
          { src: '../../LICENSE', dest: 'dist/' },
          { src: './README.md', dest: 'dist/' }
        ]
      })
    ]
  }
];
