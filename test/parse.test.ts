import { describe, expect, it } from "vitest";
import { parseArgv, UsageError } from "../src/parse.js";

describe("parseArgv", () => {
  it("parses help and version", () => {
    expect(parseArgv(["--help"])).toEqual({ cmd: "help" });
    expect(parseArgv(["-h"])).toEqual({ cmd: "help" });
    expect(parseArgv(["--version"])).toEqual({ cmd: "version" });
    expect(parseArgv(["-v"])).toEqual({ cmd: "version" });
  });

  it("parses a positional file", () => {
    expect(parseArgv(["notes.md"])).toMatchObject({
      cmd: "roast",
      positional: "notes.md",
      json: false,
      spicy: false,
      deepen: true,
      maxAnnotations: 20,
    });
  });

  it("parses prompt + answer, json, spicy, offline, color flags", () => {
    expect(
      parseArgv([
        "--prompt",
        "p.txt",
        "--answer",
        "a.txt",
        "--json",
        "--spicy",
        "--offline",
        "--no-color",
      ]),
    ).toEqual({
      cmd: "roast",
      positional: undefined,
      prompt: "p.txt",
      answer: "a.txt",
      json: true,
      spicy: true,
      color: false,
      deepen: false,
      failAbove: undefined,
      github: false,
      maxAnnotations: 20,
      quiet: false,
    });
  });

  it("parses --github", () => {
    expect(parseArgv(["--github", "notes.md"])).toMatchObject({
      cmd: "roast",
      github: true,
      positional: "notes.md",
    });
  });

  it("parses --quiet", () => {
    expect(parseArgv(["--quiet", "notes.md"])).toMatchObject({
      cmd: "roast",
      quiet: true,
      positional: "notes.md",
    });
    expect(parseArgv(["--github", "--quiet", "--json"])).toMatchObject({
      github: true,
      quiet: true,
      json: true,
    });
  });

  it("defaults quiet to false", () => {
    expect(parseArgv(["notes.md"])).toMatchObject({ quiet: false });
  });

  it("parses --fail-above threshold", () => {
    expect(parseArgv(["--fail-above", "60", "notes.md"])).toMatchObject({
      cmd: "roast",
      failAbove: 60,
      positional: "notes.md",
    });
    expect(parseArgv(["notes.md", "--fail-above", "0"])).toMatchObject({ failAbove: 0 });
    expect(parseArgv(["--fail-above", "100"])).toMatchObject({ failAbove: 100 });
  });

  it("parses --max-annotations", () => {
    expect(parseArgv(["--max-annotations", "5", "notes.md"])).toMatchObject({
      cmd: "roast",
      maxAnnotations: 5,
      positional: "notes.md",
    });
    expect(parseArgv(["--github", "--max-annotations", "1"])).toMatchObject({
      github: true,
      maxAnnotations: 1,
    });
  });

  it("defaults maxAnnotations to 20", () => {
    expect(parseArgv(["notes.md"])).toMatchObject({ maxAnnotations: 20 });
  });

  it("accepts stdin dash", () => {
    expect(parseArgv(["-"])).toMatchObject({ positional: "-", cmd: "roast" });
    expect(parseArgv(["--prompt", "-"])).toMatchObject({ prompt: "-", cmd: "roast" });
  });

  it("rejects unknown flags and mixed modes", () => {
    expect(() => parseArgv(["--nope"])).toThrow(UsageError);
    expect(() => parseArgv(["file.txt", "other.txt"])).toThrow(/at most one file/);
    expect(() => parseArgv(["file.txt", "--prompt", "p.txt"])).toThrow(/not both/);
    expect(() => parseArgv(["--prompt"])).toThrow(/requires a file path/);
  });

  it("rejects bad --fail-above values", () => {
    expect(() => parseArgv(["--fail-above"])).toThrow(/integer from 0 to 100/);
    expect(() => parseArgv(["--fail-above", "nope"])).toThrow(/integer from 0 to 100/);
    expect(() => parseArgv(["--fail-above", "1.5"])).toThrow(/integer from 0 to 100/);
    expect(() => parseArgv(["--fail-above", "-1"])).toThrow(/integer from 0 to 100/);
    expect(() => parseArgv(["--fail-above", "101"])).toThrow(/integer from 0 to 100/);
  });

  it("rejects bad --max-annotations values", () => {
    expect(() => parseArgv(["--max-annotations"])).toThrow(/positive integer/);
    expect(() => parseArgv(["--max-annotations", "0"])).toThrow(/positive integer/);
    expect(() => parseArgv(["--max-annotations", "-1"])).toThrow(/positive integer/);
    expect(() => parseArgv(["--max-annotations", "1.5"])).toThrow(/positive integer/);
    expect(() => parseArgv(["--max-annotations", "nope"])).toThrow(/positive integer/);
  });
});
