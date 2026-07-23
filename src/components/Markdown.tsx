import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// AI 生成テキストの prose スタイル。従来ページに散在していた長大なクラス列を集約
const proseFull =
  "prose prose-sm max-w-none prose-headings:font-bold prose-headings:text-gray-800 prose-h2:text-base prose-h3:text-sm prose-h3:text-primary-700 prose-p:text-gray-700 prose-p:leading-relaxed prose-li:text-gray-700 prose-li:leading-relaxed prose-strong:text-gray-900 prose-hr:my-4 prose-a:text-primary-600 prose-a:underline";

const proseCompact =
  "prose prose-sm max-w-none prose-p:text-gray-700 prose-p:leading-relaxed prose-strong:text-gray-900";

export function Markdown({
  children,
  compact = false,
}: {
  children: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? proseCompact : proseFull}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
