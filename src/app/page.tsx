'use client';

import {Box, Chip, Container, TextField} from "@mui/material";
import grayMatter from "gray-matter";
import React, {Suspense, useEffect, useState} from "react";
import {useSearchParams} from "next/navigation";
import {motion} from "motion/react"
import Divider from '@mui/material/Divider';
import {ArticleCard, Article} from "@chtc/web-components"
import {BackendArticle, Article as ArticleType} from "@chtc/web-components/types";
import {Grid} from "@mui/material";

const PUBLISH_ON_VALUES = ["htcondor", "path", "osg", "chtc", "pelican", "fabaid"];
const TYPE_VALUES = ["news", "user", "tech-blog", "feature"];
const TAG_VALUES = ["chtc_featured_article"];

function isBlank(value: unknown): boolean {
    if (typeof value === "string") return value.trim() === "";
    if (Array.isArray(value)) return value.length === 0;
    return false;
}

function describeType(value: unknown): string {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value;
}

function articleFor(word: string): string {
    return /^[aeiou]/i.test(word) ? "an" : "a";
}

function typeMismatch(expected: string, value: unknown): string {
    const actual = describeType(value);
    return `must be ${articleFor(expected)} ${expected} but is currently ${articleFor(actual)} ${actual}`;
}

function validateRequiredString(field: string, value: unknown, errors: string[], warnings: string[]) {
    if (value === undefined || value === null) {
        errors.push(`"${field}" field is missing`);
    } else if (typeof value !== "string") {
        errors.push(`"${field}" ${typeMismatch("string", value)}`);
    } else if (isBlank(value)) {
        warnings.push(`"${field}" is blank`);
    }
}

function validateOptionalString(field: string, value: unknown, errors: string[], warnings: string[]) {
    if (value === undefined || value === null) {
        warnings.push(`"${field}" is optional but missing`);
    } else if (typeof value !== "string") {
        errors.push(`"${field}" ${typeMismatch("string", value)}`);
    } else if (isBlank(value)) {
        warnings.push(`"${field}" is blank`);
    }
}

function validateEnumList(field: string, value: unknown, allowed: string[], errors: string[], warnings: string[]) {
    if (value === undefined || value === null) {
        errors.push(`"${field}" missing`);
        return;
    }
    const list = Array.isArray(value) ? value : [value];
    if (!Array.isArray(value)) {
        errors.push(`"${field}" ${typeMismatch("list", value)}`);
    }
    if (isBlank(list)) {
        warnings.push(`"${field}" is empty`);
        return;
    }
    list.filter((v: unknown) => !allowed.includes(v as string)).forEach((v: unknown) => {
        errors.push(`"${v}" is not a valid key in "${field}"`);
    });
}

type RawFrontmatter = Record<string, unknown>;

const MARKDOWN_IMAGE_REGEX = /!\[[^\]]*\]\(([^)]+)\)/g;
const HTML_IMAGE_REGEX = /<img[^>]*\ssrc=["']([^"']+)["'][^>]*>/gi;

function extractImageUrls(article: RawFrontmatter): string[] {
    const urls = new Set<string>();
    const content = typeof article.content === "string" ? article.content : "";

    for (const match of content.matchAll(MARKDOWN_IMAGE_REGEX)) {
        if (match[1]) urls.add(match[1]);
    }
    for (const match of content.matchAll(HTML_IMAGE_REGEX)) {
        if (match[1]) urls.add(match[1]);
    }

    const image = article.image as RawFrontmatter | undefined;
    if (typeof image?.path === "string") urls.add(image.path);
    if (typeof article.banner_src === "string") urls.add(article.banner_src);
    if (typeof article.card_src === "string") urls.add(article.card_src);

    return Array.from(urls).filter((url) => !isBlank(url));
}

async function checkImageSize(url: string): Promise<{ url: string; sizeBytes: number | null }> {
    try {
        const response = await fetch(url, { method: "HEAD" });
        if (!response.ok) {
            return { url, sizeBytes: null };
        }
        const contentLength = response.headers.get("content-length");
        return { url, sizeBytes: contentLength ? parseInt(contentLength, 10) : null };
    } catch {
        return { url, sizeBytes: null };
    }
}

function validateFrontmatter(article: RawFrontmatter): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    validateRequiredString("title", article.title, errors, warnings);
    validateRequiredString("author", article.author, errors, warnings);
    validateEnumList("publish_on", article.publish_on, PUBLISH_ON_VALUES, errors, warnings);

    if (article.type === undefined || article.type === null) {
        errors.push(`"type" field is missing`);
    } else if (typeof article.type !== "string") {
        errors.push(`"type" ${typeMismatch("string", article.type)}`);
    } else if (isBlank(article.type)) {
        warnings.push(`"type" is blank`);
    } else if (!TYPE_VALUES.includes(article.type)) {
        errors.push(`"type" must be one of: ${TYPE_VALUES.join(", ")}`);
    }

    validateRequiredString("canonical_url", article.canonical_url, errors, warnings);

    if (article.image === undefined || article.image === null) {
        errors.push(`"image" field is missing`);
    } else if (typeof article.image !== "object" || Array.isArray(article.image)) {
        errors.push(`"image" ${typeMismatch("object", article.image)}`);
    } else {
        const image = article.image as RawFrontmatter;
        validateRequiredString("image.path", image.path, errors, warnings);
        validateRequiredString("image.alt", image.alt, errors, warnings);
    }

    validateRequiredString("excerpt", article.excerpt, errors, warnings);

    const hasBannerSrc = article.banner_src !== undefined && article.banner_src !== null;
    const hasBannerAlt = article.banner_alt !== undefined && article.banner_alt !== null;
    if (!hasBannerSrc && !hasBannerAlt) {
        warnings.push(`"banner_src" is optional but missing`);
        warnings.push(`"banner_alt" is optional but missing`);
    } else if (hasBannerSrc && hasBannerAlt) {
        validateOptionalString("banner_src", article.banner_src, errors, warnings);
        validateOptionalString("banner_alt", article.banner_alt, errors, warnings);
    } else if (hasBannerSrc) {
        validateOptionalString("banner_src", article.banner_src, errors, warnings);
        errors.push(`"banner_alt" is missing but "banner_src" is present`);
    } else {
        validateOptionalString("banner_alt", article.banner_alt, errors, warnings);
        errors.push(`"banner_src" is missing but "banner_alt" is present`);
    }

    if (article.tag === undefined || article.tag === null) {
        warnings.push(`"tag" is optional but missing`);
    } else {
        const tags = Array.isArray(article.tag) ? article.tag : [article.tag];
        if (isBlank(tags)) {
            warnings.push(`"tag" is present but empty`);
        } else {
            tags.filter((v: unknown) => !TAG_VALUES.includes(v as string)).forEach((v: unknown) => {
                errors.push(`"${v}" is not a valid key in "tag"`);
            });
        }
    }

    return { errors, warnings };
}

interface ArticleCardBoundaryProps {
    children: React.ReactNode;
}

interface ArticleCardBoundaryState {
    error: Error | null;
}

class ArticleCardBoundary extends React.Component<ArticleCardBoundaryProps, ArticleCardBoundaryState> {
    state: ArticleCardBoundaryState = { error: null };

    static getDerivedStateFromError(error: Error): ArticleCardBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error) {
        console.error("Card Preview failed to render:", error);
    }

    render() {
        if (this.state.error) {
            return (
                <Box
                    sx={{
                        backgroundColor: "white",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        padding: "16px",
                        whiteSpace: "pre-wrap",
                        fontFamily: "monospace",
                        fontSize: "14px",
                    }}
                >
                    <Box color="red">Error rendering card preview: {this.state.error.message}. Please check frontmatter for errors.</Box>
                </Box>
            );
        }

        return this.props.children;
    }
}

export default function MarkdownPage() {
    return (
        <Container>
            <Suspense>
                <MarkdownContent />
            </Suspense>
        </Container>
    );
}

function formatFrontmatter(frontmatter: BackendArticle) {
    const newFrontmatter: Partial<BackendArticle> = {...frontmatter};
    delete newFrontmatter.content;
    delete newFrontmatter.slug;
    delete newFrontmatter.path;
    delete newFrontmatter.date;
    return JSON.stringify(newFrontmatter, null, 2);
}

function updateUrl(url: string) {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('url', url);
    window.history.pushState({}, '', currentUrl.toString());
}

function MarkdownContent() {
    const searchParams = useSearchParams();
    const markdownUrl = searchParams.get("url");

    const [article, setArticle] = useState<BackendArticle | null>(null);

    const [error, setError] = useState<string | undefined>(undefined);

    const [imageSizeMessages, setImageSizeMessages] = useState<{ text: string; level: "error" | "warning" }[]>([]);

    useEffect(() => {
        (async () => {

            const markdownUrl = searchParams.get("url");

            if (!markdownUrl) {
                setError("No URL provided");
                return;
            }

            let response;
            try {
                response = await fetch(markdownUrl);
                if (!response.ok) {
                    setError(`Failed to fetch markdown: ${response.statusText}`);
                    return
                }
            } catch (e) {
                setError(`Failed to fetch markdown: ${e}`);
                return
            }

            const markdown = await response.text()

            try {
                const {data, content} = grayMatter(markdown);

                const path = markdownUrl.split("/").slice(-1)[0];
                const date = new Date(path.split("-").slice(0, 3).join("-"));

                const article = {
                    slug: [],
                    date: date,
                    path: markdownUrl.split("/").slice(-1)[0],
                    content,
                    ...(data as Omit<ArticleType, "content" | "date">)
                }

                setArticle(article as BackendArticle)
                setError(undefined)
            } catch (e) {

                if(e instanceof Error) {
                    console.error(e)
                    setError(`Failed to parse markdown frontmatter: ${e['message'] ? e.message : JSON.stringify(e)}`);
                    return
                }

            }

        })();
    }, [markdownUrl, searchParams]);

    useEffect(() => {
        if (!article) return;
        let cancelled = false;

        (async () => {
            const urls = extractImageUrls(article as unknown as RawFrontmatter);
            const results = await Promise.all(urls.map(checkImageSize));
            if (cancelled) return;

            const messages: { text: string; level: "error" | "warning" }[] = [];
            for (const {url, sizeBytes} of results) {
                if (sizeBytes === null) {
                    messages.push({text: `Could not determine size for "${url}"`, level: "warning"});
                } else if (sizeBytes > 1024 * 1024) {
                    messages.push({text: `"${url}" is ${(sizeBytes / 1024 / 1024).toFixed(2)}MB. Please limit images to 1MB in size.`, level: "warning"});
                }
            }
            setImageSizeMessages(messages);
        })();

        return () => {
            cancelled = true;
        };
    }, [article]);

    if (error) {
        return (
            <Container>
                <Box color={"red"}>{error}</Box>
                <TextField onChange={(e) => updateUrl(e.target.value)} label="Enter URL" fullWidth/>
            </Container>
        )
    }

    if (!article) {
        return (
            <Container>
                <h1>Loading</h1>
            </Container>
        )
    }

    const {errors: frontmatterErrors, warnings: frontmatterWarnings} = validateFrontmatter(article as unknown as RawFrontmatter);

    return (
        <Box pb="70px">
            {imageSizeMessages.length > 0 && (
                <>
                    <Divider
                        variant="middle"
                        sx={{
                            backgroundColor: "black",
                            width: "100%",
                            height: "3px",
                            my: "70px",
                            marginLeft: "0",
                            marginRight: "0",
                        }}
                    >
                        <Chip label="Image Size Warnings" size="medium" sx={{ fontSize: "1.2rem", padding: "8px 16px", marginTop: "12px" }} />
                    </Divider>
                    <Box
                        sx={{
                            backgroundColor: "white",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            padding: "16px",
                            whiteSpace: "pre-wrap",
                            fontFamily: "monospace",
                            fontSize: "14px",
                        }}
                    >
                        {imageSizeMessages.map((m, i) => (
                            <Box color={m.level === "error" ? "red" : "goldenrod"} key={i}>
                                {m.level === "error" ? "Error: " : "Warning: "}{m.text}
                            </Box>
                        ))}
                    </Box>
                </>
            )}

            <Divider
                variant="middle"
                sx={{
                    backgroundColor: "black",
                    width: "100%",
                    height: "3px",
                    my: "70px",
                    marginLeft: "0",
                    marginRight: "0",
                }}
            >
                <Chip label="Frontmatter Preview" size="medium" sx={{ fontSize: "1.2rem", padding: "8px 16px", marginTop: "12px" }} />
            </Divider>
            <Box
                sx={{
                    backgroundColor: "white",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    padding: "16px",
                    whiteSpace: "pre-wrap",
                    fontFamily: "monospace",
                    fontSize: "14px",
                }}
            >
                {article ? formatFrontmatter(article) : "No frontmatter"}
            </Box>

            <Box
                sx={{
                    backgroundColor: "white",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    padding: "16px",
                    whiteSpace: "pre-wrap",
                    fontFamily: "monospace",
                    fontSize: "14px",
                    marginTop: "24px",
                }}
            >
                {frontmatterErrors.length === 0 && frontmatterWarnings.length === 0 ? (
                    <Box color="green">No errors or warnings</Box>
                ) : (
                    <>
                        {frontmatterErrors.map((e, i) => <Box color="red" key={`error-${i}`}>Error: {e}</Box>)}
                        {frontmatterWarnings.map((w, i) => <Box color="orange" key={`warning-${i}`}>Warning: {w}</Box>)}
                    </>
                )}
            </Box>

            <Divider
                variant="middle"
                sx={{
                    backgroundColor: "black",
                    width: "100%",
                    height: "3px",
                    my: "70px",
                    marginLeft: "0",
                    marginRight: "0",
                }}
            >
                <Chip label="Article Preview" size="medium" sx={{ fontSize: "1.2rem", padding: "8px 16px", marginTop: "12px" }} />
            </Divider>
            <Box>
                <Article article={article} />
            </Box>

            <Divider
                variant="middle"
                sx={{
                    backgroundColor: "black",
                    width: "100%",
                    height: "3px",
                    my: "70px",
                    marginLeft: "0",
                    marginRight: "0",
                }}
            >
                <Chip label="Card Preview" size="medium" sx={{ fontSize: "1.2rem", padding: "8px 16px", marginTop: "12px" }} />
            </Divider>
            <Grid container justifyContent={"center"}>
                <Grid size={{ xs: 12, md: 6, lg: 4 }}>
                    <ArticleCardBoundary key={article.path}>
                        <ArticleCard href={"./"} article={article} />
                    </ArticleCardBoundary>
                </Grid>
            </Grid>

            <Divider
                variant="middle"
                sx={{
                    backgroundColor: "black",
                    width: "100%",
                    height: "3px",
                    my: "70px",
                    marginLeft: "0",
                    marginRight: "0",
                }}
            >
                <Chip label="Banner Preview" size="medium" sx={{ fontSize: "1.2rem", padding: "8px 16px", marginTop: "12px" }} />
            </Divider>
            {typeof article.banner_src === "string" && !isBlank(article.banner_src) ? (
                <Box>
                    <motion.img
                        src={article.banner_src}
                        alt={article.banner_alt || "Banner"}
                        style={{ width: "100%", aspectRatio: "2/1" }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.95 }}
                    />
                </Box>
            ) : (
                <Box
                    sx={{
                        backgroundColor: "white",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        padding: "16px",
                        whiteSpace: "pre-wrap",
                        fontFamily: "monospace",
                        fontSize: "14px",
                    }}
                >
                    <Box color="orange">Warning: banner not present</Box>
                </Box>
            )}
        </Box>
    )
}


