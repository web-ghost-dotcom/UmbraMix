'use client';

import { useEffect, useState, useRef } from 'react';
import {
  BookOpenIcon,
  Bars3Icon,
  XMarkIcon,
  MagnifyingGlassIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import mermaid from 'mermaid';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface DocSection {
  id: string;
  title: string;
  path: string;
}

interface DocGroup {
  title: string;
  items: DocSection[];
}

const DOCS_STRUCTURE: DocGroup[] = [
  {
    title: 'Getting Started',
    items: [
      { id: 'getting-started', title: 'Introduction', path: '/docs/GETTING_STARTED.md' },
    ]
  },
  {
    title: 'Core Concepts',
    items: [
      { id: 'architecture', title: 'Architecture', path: '/docs/MIXER_ARCHITECTURE.md' },
      { id: 'privacy-strategy', title: 'Privacy Strategy', path: '/docs/PRIVACY_STRATEGY.md' },
      { id: 'cryptography', title: 'Cryptography', path: '/docs/CRYPTOGRAPHY.md' },
    ]
  },
  {
    title: 'API Reference',
    items: [
      { id: 'endpoints', title: 'Endpoints', path: '/docs/API_ENDPOINTS.md' },
    ]
  }
];

export default function DocsPage() {
  const [currentDocId, setCurrentDocId] = useState<string>('getting-started');
  const [markdown, setMarkdown] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Helper to extract text from React children
  const getTextFromChildren = (children: any): string => {
    if (!children) return '';
    if (typeof children === 'string') return children;
    if (Array.isArray(children)) return children.map(getTextFromChildren).join('');
    if (typeof children === 'object' && children.props && children.props.children) {
      return getTextFromChildren(children.props.children);
    }
    return '';
  };

  // Ref for content to scope mermaid diagram rendering
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
      fontFamily: 'inherit'
    });
  }, []);

  useEffect(() => {
    const loadDoc = async () => {
      setLoading(true);
      try {
        // Find the current doc path
        let docPath = '/docs/GETTING_STARTED.md';
        for (const group of DOCS_STRUCTURE) {
          const found = group.items.find(item => item.id === currentDocId);
          if (found) {
            docPath = found.path;
            break;
          }
        }

        const res = await fetch(docPath);
        if (!res.ok) throw new Error('Failed to fetch doc');
        const text = await res.text();

        setMarkdown(text);
        extractToc(text);
        setLoading(false);
        // Scroll to top when switching docs
        window.scrollTo(0, 0);

      } catch (err) {
        console.error('Failed to load docs:', err);
        setLoading(false);
        setMarkdown('# Error\n\nFailed to load documentation file.');
      }
    };

    loadDoc();
  }, [currentDocId]);

  useEffect(() => {
    if (!loading && contentRef.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(async () => {
        try {
          const nodes = Array.from(contentRef.current?.querySelectorAll('.mermaid') || []) as HTMLElement[];
          console.log(`Found ${nodes.length} mermaid diagrams to render`);

          // Process each diagram individually to isolate errors
          for (const node of nodes) {
            try {
              await mermaid.run({
                nodes: [node],
                suppressErrors: true // Let us handle errors
              });
            } catch (err) {
              console.error('Failed to render mermaid diagram:', err);
              console.error('Diagram content:', node.textContent);
              // Optionally show error in the UI
              node.innerHTML = `<div class="text-red-500 text-xs p-2 border border-red-500/20 rounded bg-red-500/10">Mermaid Error: ${err instanceof Error ? err.message : 'Unknown error'}</div><pre class="text-xs text-gray-500 mt-2 overflow-x-auto">${node.textContent}</pre>`;
            }
          }
        } catch (err) {
          console.error('Mermaid initialization error:', err);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, markdown]);

  // ScrollSpy
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-100px 0px -66% 0px' }
    );

    const headings = document.querySelectorAll('h2[id], h3[id]');
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [loading, markdown]);

  const extractToc = (text: string) => {
    const lines = text.split('\n');
    const items: TocItem[] = [];

    // Helper to clean markdown syntax from TOC text
    const cleanMarkdown = (text: string) => {
      return text
        .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
        .replace(/\*(.*?)\*/g, '$1')     // Italic
        .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Links
        .replace(/`(.*?)`/g, '$1');      // Code
    };

    lines.forEach((line) => {
      const h2 = line.match(/^##\s+(.+)$/);
      const h3 = line.match(/^###\s+(.+)$/);
      if (h2) {
        const text = cleanMarkdown(h2[1]);
        items.push({
          id: text.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          text: text,
          level: 2
        });
      } else if (h3) {
        const text = cleanMarkdown(h3[1]);
        items.push({
          id: text.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          text: text,
          level: 3
        });
      }
    });
    setToc(items);
  };

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      // Use scrollIntoView with block: 'start' and behavior: 'smooth'
      // But we need offset for sticky header. 
      // Better to use window.scrollTo for precise offset control
      const headerOffset = 100;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
      setActiveId(id);
      setMobileMenuOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1117] text-gray-300 font-sans selection:bg-violet-500/30">

      {/* Top Navigation Bar - GitBook Style */}
      <header className="fixed top-0 inset-x-0 h-16 bg-[#0F1117]/80 backdrop-blur-md border-b border-white/5 z-50 flex items-center px-4 lg:px-8 justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 hover:bg-white/5 rounded-lg text-gray-400"
          >
            {mobileMenuOpen ? <XMarkIcon className="w-5 h-5" /> : <Bars3Icon className="w-5 h-5" />}
          </button>
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center border border-violet-500/20 group-hover:border-violet-500/40 transition-colors">
              <BookOpenIcon className="w-4 h-4 text-violet-400" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-white tracking-tight leading-none">UmbraMix</span>
              <span className="text-[10px] text-gray-500 font-mono">DOCS</span>
            </div>
          </Link>
        </div>

        <div className="flex-1 max-w-md px-4 hidden md:block">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-4 w-4 text-gray-500 group-hover:text-gray-400 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Search documentation..."
              className="w-full bg-white/[0.03] border border-white/5 rounded-lg py-1.5 pl-10 pr-4 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/30 hover:border-white/10 transition-all"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-gray-600 text-xs border border-white/5 rounded px-1.5 py-0.5">⌘K</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="text-sm font-medium text-gray-400 hover:text-white transition-colors px-3 py-2">
            Dashboard
          </Link>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
          </a>
        </div>
      </header>

      <div className="flex max-w-[1600px] mx-auto pt-16 min-h-screen">

        {/* Left Sidebar - Navigation Tree */}
        <aside className={`
                fixed inset-y-0 left-0 z-40 w-72 bg-[#0F1117] border-r border-white/5 transform transition-transform duration-300 lg:translate-x-0 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] pt-8
                ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
          <div className="h-full overflow-y-auto px-6 pb-8 custom-scrollbar">

            {DOCS_STRUCTURE.map((group, groupIdx) => (
              <div key={groupIdx} className="mb-8">
                <h3 className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-3 px-2">{group.title}</h3>
                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <button
                        onClick={() => {
                          setCurrentDocId(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex text-left px-2 py-1.5 text-sm rounded-lg transition-colors ${currentDocId === item.id
                          ? 'bg-violet-500/10 text-violet-300 font-medium border border-violet-500/20'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                          }`}
                      >
                        {item.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 px-4 sm:px-8 lg:px-12 py-12">
          <div className="max-w-4xl mx-auto">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-8 font-medium">
              <span>Docs</span>
              <ChevronRightIcon className="w-3 h-3" />
              {(() => {
                const group = DOCS_STRUCTURE.find(g => g.items.some(i => i.id === currentDocId));
                const item = group?.items.find(i => i.id === currentDocId);

                return (
                  <>
                    <span>{group?.title || 'Docs'}</span>
                    <ChevronRightIcon className="w-3 h-3" />
                    <span className="text-violet-400">{item?.title || ''}</span>
                  </>
                );
              })()}
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 space-y-4">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-500 text-sm animate-pulse">Loading content...</p>
              </div>
            ) : (
              <div ref={contentRef} className="prose prose-invert prose-headings:font-semibold prose-h1:text-4xl prose-h2:text-2xl prose-h2:mt-12 prose-a:text-violet-400 prose-pre:bg-[#1A1D24] prose-pre:border prose-pre:border-white/5 max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ node, inline, className, children, ...props }: any) {
                      const match = /language-(\w+)/.exec(className || '')
                      const lang = match ? match[1] : ''

                      if (lang === 'mermaid') {
                        return (
                          <div className="mermaid my-8 bg-[#1A1D24] p-6 rounded-xl border border-white/5 flex justify-center overflow-x-auto">
                            {String(children).replace(/\n$/, '')}
                          </div>
                        )
                      }

                      return !inline && match ? (
                        <div className="relative group">
                          <div className="absolute right-2 top-2 px-2 py-1 text-xs text-gray-500 bg-black/50 rounded pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity uppercase">{lang}</div>
                          <SyntaxHighlighter
                            style={vscDarkPlus}
                            language={lang}
                            PreTag="div"
                            customStyle={{ margin: 0, borderRadius: '0.75rem', background: '#16181D' }}
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        </div>
                      ) : (
                        <code className="text-violet-300 bg-violet-500/10 px-1.5 py-0.5 rounded font-mono text-sm" {...props}>
                          {children}
                        </code>
                      )
                    },
                    h1: ({ node, ...props }) => <h1 className="text-4xl font-bold tracking-tight text-white mb-8" {...props} />,
                    h2: ({ node, children, ...props }) => {
                      const text = getTextFromChildren(children);
                      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                      return (
                        <h2 id={id} className="group flex items-center gap-2 mt-12 mb-6 text-2xl font-bold text-white border-b border-white/5 pb-2 cursor-pointer scroll-mt-24" onClick={() => scrollTo(id)} {...props}>
                          {children}
                          <span className="opacity-0 group-hover:opacity-100 text-violet-500 text-lg transition-opacity">#</span>
                        </h2>
                      )
                    },
                    h3: ({ node, children, ...props }) => {
                      const text = getTextFromChildren(children);
                      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                      return (
                        <h3 id={id} className="group flex items-center gap-2 mt-8 mb-4 text-xl font-bold text-white cursor-pointer scroll-mt-24" onClick={() => scrollTo(id)} {...props}>
                          {children}
                          <span className="opacity-0 group-hover:opacity-100 text-violet-500 text-base transition-opacity">#</span>
                        </h3>
                      )
                    },
                    blockquote: ({ node, ...props }) => (
                      <div className="border-l-4 border-violet-500 bg-violet-500/5 rounded-r-lg py-4 px-6 my-6 text-gray-300 italic">
                        {props.children}
                      </div>
                    ),
                    table: ({ node, ...props }) => (
                      <div className="overflow-x-auto my-8 border border-white/10 rounded-lg">
                        <table className="min-w-full divide-y divide-white/10 text-left text-sm" {...props} />
                      </div>
                    ),
                    thead: ({ node, ...props }) => <thead className="bg-white/5 font-semibold text-white" {...props} />,
                    tbody: ({ node, ...props }) => <tbody className="divide-y divide-white/5 bg-transparent" {...props} />,
                    th: ({ node, ...props }) => <th className="px-4 py-3" {...props} />,
                    td: ({ node, ...props }) => <td className="px-4 py-3 whitespace-nowrap text-gray-300" {...props} />,
                  }}
                >
                  {markdown}
                </ReactMarkdown>
              </div>
            )}

            {/* Footer Nav */}
            <div className="mt-20 pt-8 border-t border-white/5 flex justify-between gap-4">
              {(() => {
                const allItems = DOCS_STRUCTURE.flatMap(g => g.items);
                const currentIndex = allItems.findIndex(i => i.id === currentDocId);
                const prev = currentIndex > 0 ? allItems[currentIndex - 1] : null;
                const next = currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : null;

                return (
                  <>
                    {prev ? (
                      <button
                        onClick={() => {
                          setCurrentDocId(prev.id);
                          window.scrollTo(0, 0);
                        }}
                        className="flex-1 p-6 rounded-xl border border-white/5 hover:border-violet-500/30 hover:bg-white/[0.02] text-left transition-all group"
                      >
                        <div className="text-xs text-gray-500 mb-1 group-hover:text-violet-400 transition-colors">Previous</div>
                        <div className="font-semibold text-white">{prev.title}</div>
                      </button>
                    ) : <div className="flex-1"></div>}

                    {next ? (
                      <button
                        onClick={() => {
                          setCurrentDocId(next.id);
                          window.scrollTo(0, 0);
                        }}
                        className="flex-1 p-6 rounded-xl border border-white/5 hover:border-violet-500/30 hover:bg-white/[0.02] text-right transition-all group"
                      >
                        <div className="text-xs text-gray-500 mb-1 group-hover:text-violet-400 transition-colors">Next</div>
                        <div className="font-semibold text-white">{next.title}</div>
                      </button>
                    ) : <div className="flex-1"></div>}
                  </>
                );
              })()}
            </div>
          </div>
        </main>

        {/* Right Sidebar - On This Page */}
        <aside className="hidden xl:block w-64 flex-shrink-0 pt-12 pr-8 sticky top-20 h-[calc(100vh-5rem)] overflow-y-auto custom-scrollbar">
          <div className="pl-6 border-l border-white/5">
            <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">On This Page</h5>
            <ul className="space-y-3 text-sm">
              {toc.map((item, idx) => (
                <li key={idx} style={{ marginLeft: (item.level - 2) * 12 }}>
                  <button
                    onClick={() => scrollTo(item.id)}
                    className={`text-left transition-colors hover:text-violet-400 line-clamp-1 ${activeId === item.id
                      ? 'text-violet-400 font-medium'
                      : 'text-gray-500'
                      }`}
                  >
                    {item.text}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
