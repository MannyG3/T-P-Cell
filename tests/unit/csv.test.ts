import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, rowsToRecords, toCsv } from "../../src/lib/csv.ts";

describe("parseCsv", () => {
  it("parses simple rows", () => {
    assert.deepEqual(parseCsv("a,b\n1,2\n"), [["a", "b"], ["1", "2"]]);
  });

  it("handles quoted commas, escaped quotes and CRLF", () => {
    assert.deepEqual(parseCsv('name,company\r\n"Shah, Aarav","L&T ""Heavy"""\r\n'), [["name", "company"], ["Shah, Aarav", 'L&T "Heavy"']]);
  });

  it("keeps newlines inside quoted fields", () => {
    assert.deepEqual(parseCsv('a\n"line 1\nline 2"'), [["a"], ["line 1\nline 2"]]);
  });

  it("strips a UTF-8 BOM and skips blank lines", () => {
    assert.deepEqual(parseCsv("﻿a,b\n\n1,2\n,\n"), [["a", "b"], ["1", "2"]]);
  });

  it("parses a final row without a trailing newline", () => {
    assert.deepEqual(parseCsv("a\n1"), [["a"], ["1"]]);
  });
});

describe("rowsToRecords", () => {
  it("normalises headers to snake_case and trims values", () => {
    const { headers, records } = rowsToRecords([["Full Name", " Roll No. ", "Batch-Year"], [" Priya ", "IF-1", "2025"]]);
    assert.deepEqual(headers, ["full_name", "roll_no", "batch_year"]);
    assert.deepEqual(records, [{ full_name: "Priya", roll_no: "IF-1", batch_year: "2025" }]);
  });

  it("fills missing trailing cells with empty strings", () => {
    assert.deepEqual(rowsToRecords([["a", "b"], ["1"]]).records, [{ a: "1", b: "" }]);
  });
});

describe("toCsv", () => {
  it("escapes only when needed and round-trips through parseCsv", () => {
    const rows = [["name", "note"], ["Sneha", 'said "hi", left'], ["Rohan", null], ["Kunal", 7.5]];
    const csv = toCsv(rows);
    assert.equal(csv.split("\r\n")[1], 'Sneha,"said ""hi"", left"');
    assert.deepEqual(parseCsv(csv), [["name", "note"], ["Sneha", 'said "hi", left'], ["Rohan", ""], ["Kunal", "7.5"]]);
  });
});
