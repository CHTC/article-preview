'use client';

import {Box, Chip, Container, TextField} from "@mui/material";
import grayMatter from "gray-matter";
import React, {Suspense, useEffect, useState} from "react";
import {useSearchParams} from "next/navigation";
import {motion} from "motion/react"
import Divider from '@mui/material/Divider';
import {ArticleCard, Article} from "@chtc/web-components"
import {BackendArticle, Article as ArticleType} from "@chtc/web-components/dist/types";
import {Grid2 as Grid} from "@mui/material";

export default function MarkdownPage() {
    return (
        <Container>
            <Suspense>
                <MarkdownContent />
            </Suspense>
        </Container>
    );
}

function MarkdownContent() {
    const searchParams = useSearchParams();
    const markdownUrl = searchParams.get("url");

    const [article, setArticle] = useState<BackendArticle | null>(null);
    const [error, setError] = useState<string | undefined>(undefined);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        (async () => {

            const markdownUrl = searchParams.get("url");

            if (!markdownUrl) {
                setError("No URL provided");
                return;
            }

            try {
                const response = await fetch(markdownUrl);
                if (!response.ok) {
                    setError(`Failed to fetch markdown: ${response.statusText}`);
                    setIsLoading(false);
                    return;
                }

                const markdown = await response.text();

                let parsedData;
                try {
                    parsedData = grayMatter(markdown);
                } catch {
                    setError("Error parsing markdown file. Ensure it has valid frontmatter");
                    setIsLoading(false);
                    return;
                }

                const { data, content } = parsedData;
                const pathParts = markdownUrl.split("/");
                const filename = pathParts[pathParts.length - 1] || "";

                if (!filename) {
                    setError("Invalid markdown file path");
                    setIsLoading(false);
                    return;
                }

                const dateParts = filename.split("-").slice(0, 3);
                const date = dateParts.length === 3 ? new Date(dateParts.join("-")) : new Date();

                setArticle({
                    slug: [],
                    date: date,
                    path: filename,
                    content,
                    ...(data as Omit<ArticleType, "content" | "date">)
                } as BackendArticle);
            } catch {
                setError("Article fetch failed");
            } finally {
                setIsLoading(false);
            }
        })();
    }, [markdownUrl, searchParams]);

    if (error) {
        return (
            <Container>
                <h1>{error}</h1>
                <TextField onChange={(e) => updateUrl(e.target.value)} label="Enter URL" fullWidth/>
            </Container>
        )
    }

    if (isLoading) {
        return (
            <Container>
                <h1>Loading...</h1>
            </Container>
        );
    }

    if (!article) {
        return (
            <Container>
                <h1>No article found</h1>
            </Container>
        );
    }

    return (
        <Box>
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
                <Chip label="Frontmatter Preview" size="medium" sx={{ fontSize: "1.2rem", padding: "8px 16px" }} />
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
                <Chip label="Article Preview" size="medium" sx={{ fontSize: "1.2rem", padding: "8px 16px" }} />
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
                <Chip label="Card Preview" size="medium" sx={{ fontSize: "1.2rem", padding: "8px 16px" }} />
            </Divider>
            <Grid container justifyContent={"center"}>
                <Grid size={{ xs: 12, md: 6, lg: 4 }}>
                    <ArticleCard href={"./"} article={article} />
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
                <Chip label="Banner Preview" size="medium" sx={{ fontSize: "1.2rem", padding: "8px 16px" }} />
            </Divider>
            {article.banner_src ? (
                <Box>
                    <motion.img
                        src={article.banner_src}
                        alt={article.banner_alt || "Banner"}
                        style={{ width: "100%", aspectRatio: "2/1" }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.95 }}
                    />
                </Box>
            ) : null}
        </Box>
    )
}

const formatFrontmatter = (frontmatter: BackendArticle) => {
    const newFrontmatter: Partial<BackendArticle> = {...frontmatter};
    delete newFrontmatter.content;
    delete newFrontmatter.slug;
    delete newFrontmatter.path;
    delete newFrontmatter.date;
    return JSON.stringify(newFrontmatter, null, 2);
}

const updateUrl = (url: string) => {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('url', url);
    window.history.pushState({}, '', currentUrl.toString());
}
