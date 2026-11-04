import { describe, expect, it } from "vitest";
import { parseMarkdown } from "./markdown";

const text = (value: string) => ({ type: "text", text: value });
const code = (value: string) => ({ type: "code", text: value });

describe("parseMarkdown", () => {
  it("leaves plain text as one piece", () => {
    expect(parseMarkdown("One test fails.")).toEqual([text("One test fails.")]);
  });

  it("finds bold and inline code", () => {
    expect(parseMarkdown("Run `npm test`, it **fails**.")).toEqual([
      text("Run "),
      code("npm test"),
      text(", it "),
      { type: "bold", children: [text("fails")] },
      text("."),
    ]);
  });

  it("allows code inside bold, like a real answer", () => {
    expect(parseMarkdown("It's in **`src/auth.ts`**.")).toEqual([
      text("It's in "),
      { type: "bold", children: [code("src/auth.ts")] },
      text("."),
    ]);
  });

  it("keeps ** inside code as written", () => {
    expect(parseMarkdown("`a ** b ** c`")).toEqual([code("a ** b ** c")]);
    expect(parseMarkdown("**a `b**` c**")).toEqual([{ type: "bold", children: [text("a "), code("b**"), text(" c")] }]);
  });

  it("uses double backticks for code that holds a backtick", () => {
    expect(parseMarkdown("`` a`b ``")).toEqual([code("a`b")]);
  });

  it.each(["2 ** 3", "** loose **", "**never closed", "`never closed", "**", "****"])(
    "leaves %j as written",
    (input) => {
      expect(parseMarkdown(input)).toEqual([text(input)]);
    },
  );

  it("doesn't let bold run onto the next line", () => {
    expect(parseMarkdown("**a\nb**")).toEqual([text("**a\nb**")]);
  });

  it("keeps line breaks", () => {
    expect(parseMarkdown("**One** test fails.\n\nThe rest pass.")).toEqual([
      { type: "bold", children: [text("One")] },
      text(" test fails.\n\nThe rest pass."),
    ]);
  });

  it("leaves code blocks alone", () => {
    const answer = "Like this:\n```py\nx**2 + y**2 == `z`\n```\nDone **now**.";
    expect(parseMarkdown(answer)).toEqual([
      text("Like this:\n```py\nx**2 + y**2 == `z`\n```\nDone "),
      { type: "bold", children: [text("now")] },
      text("."),
    ]);
  });

  it("keeps HTML as plain text", () => {
    expect(parseMarkdown("<img src=x onerror=alert(1)> **hi**")).toEqual([
      text("<img src=x onerror=alert(1)> "),
      { type: "bold", children: [text("hi")] },
    ]);
  });
});
