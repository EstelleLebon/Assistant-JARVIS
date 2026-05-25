export function stripMarkdown(text: string): string {
    return (
        text
            // headers
            .replace(/^#{1,6}\s+/gm, '')
            // bold/italic: ***x***, **x**, *x*, ___x___, __x__, _x_
            .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
            .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
            // inline code
            .replace(/`([^`]+)`/g, '$1')
            // code blocks
            .replace(/```[\s\S]*?```/g, '')
            // blockquotes
            .replace(/^>\s+/gm, '')
            // horizontal rules
            .replace(/^[-*_]{3,}\s*$/gm, '')
            // unordered list bullets
            .replace(/^[\s]*[-*+]\s+/gm, '')
            // ordered list numbers
            .replace(/^[\s]*\d+\.\s+/gm, '')
            // links: [text](url) → text
            .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
            // images
            .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
            // collapse multiple blank lines
            .replace(/\n{3,}/g, '\n\n')
            .trim()
    )
}
