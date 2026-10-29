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
    });
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
});
