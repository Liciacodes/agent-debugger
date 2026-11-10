import { Fragment } from "react";
import { type MarkdownPiece, parseMarkdown } from "@/ui/markdown";

function Pieces({ pieces }: { pieces: MarkdownPiece[] }) {
  return pieces.map((piece, index) => {
    switch (piece.type) {
      case "text":
        return <Fragment key={index}>{piece.text}</Fragment>;
      case "code":
        return (
          <code key={index} className="font-mono text-xs text-warn-soft">
            {piece.text}
          </code>
        );
      case "bold":
        return (
          <strong key={index} className="font-semibold text-fg">
            <Pieces pieces={piece.children} />
          </strong>
        );
    }
  });
}

// Shows **bold** and `code` styled instead of with their marks. The text only
// ever goes in as text, so any HTML in it is shown, not run.
export function FormattedText({ text }: { text: string }) {
  return <Pieces pieces={parseMarkdown(text)} />;
}
