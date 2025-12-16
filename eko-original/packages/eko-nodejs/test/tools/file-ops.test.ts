import * as fs from "fs/promises";
import * as path from "path";
import { FileReadTool } from "../../src/tools/file-read";
import { FileWriteTool } from "../../src/tools/file-write";
import { FileDeleteTool } from "../../src/tools/file-delete";
import { FileListTool } from "../../src/tools/file-list";
import { FileSecurityOptions } from "../../src/types/file.types";

describe("File Operations Tools", () => {
  const testDir = path.join(process.cwd(), "test-temp");
  const workPath = testDir;

  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe("FileReadTool", () => {
    test("file_read returns file contents", async () => {
      const filePath = path.join(testDir, "test.txt");
      const content = "Hello, World!";
      await fs.writeFile(filePath, content);

      const securityOptions: FileSecurityOptions = { restrictToWorkPath: true };
      const tool = new FileReadTool(workPath, securityOptions);
      const result = await tool.execute({ filePath: "test.txt" });

      expect(result.content).toEqual([{ type: "text", text: content }]);
      expect(result.isError).toBeFalsy();
    });

    test("file_read throws on non-existent file", async () => {
      const securityOptions: FileSecurityOptions = { restrictToWorkPath: true };
      const tool = new FileReadTool(workPath, securityOptions);
      const result = await tool.execute({ filePath: "nonexistent.txt" });

      expect(result.isError).toBe(true);
      expect(result.content).toBeDefined();
      expect(JSON.stringify(result.content)).toContain("ENOENT");
    });

    test("path traversal blocked when security enabled", async () => {
      const securityOptions: FileSecurityOptions = { restrictToWorkPath: true };
      const tool = new FileReadTool(workPath, securityOptions);
      const result = await tool.execute({ filePath: "../../../etc/passwd" });

      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toContain("Access denied");
    });

    test("absolute paths outside workPath blocked", async () => {
      const securityOptions: FileSecurityOptions = { restrictToWorkPath: true };
      const tool = new FileReadTool(workPath, securityOptions);
      const result = await tool.execute({ filePath: "/etc/passwd" });

      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toContain("Access denied");
    });
  });

  describe("FileWriteTool", () => {
    test("file_write creates file with content", async () => {
      const securityOptions: FileSecurityOptions = { restrictToWorkPath: true };
      const tool = new FileWriteTool(workPath, securityOptions);
      const content = "Test content";
      const result = await tool.execute({
        filePath: "newfile.txt",
        content,
      });

      expect(result.isError).toBeFalsy();

      // Verify file was created
      const filePath = path.join(testDir, "newfile.txt");
      const fileContent = await fs.readFile(filePath, "utf-8");
      expect(fileContent).toBe(content);
    });

    test("file_write creates parent directories", async () => {
      const securityOptions: FileSecurityOptions = { restrictToWorkPath: true };
      const tool = new FileWriteTool(workPath, securityOptions);
      const content = "Nested content";
      const result = await tool.execute({
        filePath: "nested/dir/file.txt",
        content,
      });

      expect(result.isError).toBeFalsy();

      // Verify file was created in nested directory
      const filePath = path.join(testDir, "nested/dir/file.txt");
      const fileContent = await fs.readFile(filePath, "utf-8");
      expect(fileContent).toBe(content);
    });

    test("file_write append mode works", async () => {
      const filePath = path.join(testDir, "append.txt");
      await fs.writeFile(filePath, "First line\n");

      const securityOptions: FileSecurityOptions = { restrictToWorkPath: true };
      const tool = new FileWriteTool(workPath, securityOptions);
      const result = await tool.execute({
        filePath: "append.txt",
        content: "Second line\n",
        append: true,
      });

      expect(result.isError).toBeFalsy();

      // Verify content was appended
      const fileContent = await fs.readFile(filePath, "utf-8");
      expect(fileContent).toBe("First line\nSecond line\n");
    });
  });

  describe("FileDeleteTool", () => {
    test("file_delete removes file", async () => {
      const filePath = path.join(testDir, "delete-me.txt");
      await fs.writeFile(filePath, "Delete this");

      const securityOptions: FileSecurityOptions = { restrictToWorkPath: true };
      const tool = new FileDeleteTool(workPath, securityOptions);
      const result = await tool.execute({ filePath: "delete-me.txt" });

      expect(result.isError).toBeFalsy();

      // Verify file was deleted
      await expect(fs.access(filePath)).rejects.toThrow();
    });

    test("file_delete throws on non-existent file", async () => {
      const securityOptions: FileSecurityOptions = { restrictToWorkPath: true };
      const tool = new FileDeleteTool(workPath, securityOptions);
      const result = await tool.execute({ filePath: "nonexistent.txt" });

      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toContain("ENOENT");
    });
  });

  describe("FileListTool", () => {
    test("file_list returns directory contents", async () => {
      // Create test files
      await fs.writeFile(path.join(testDir, "file1.txt"), "content1");
      await fs.writeFile(path.join(testDir, "file2.txt"), "content2");
      await fs.mkdir(path.join(testDir, "subdir"));

      const securityOptions: FileSecurityOptions = { restrictToWorkPath: true };
      const tool = new FileListTool(workPath, securityOptions);
      const result = await tool.execute({ directoryPath: "." });

      expect(result.isError).toBeFalsy();
      expect(result.content).toBeDefined();

      const contentStr = JSON.stringify(result.content);
      expect(contentStr).toContain("file1.txt");
      expect(contentStr).toContain("file2.txt");
      expect(contentStr).toContain("subdir");
    });
  });
});
