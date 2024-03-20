import lume from "lume/mod.ts";
import { Data, Page } from "lume/core/file.ts";
import { safeLoad } from "https://deno.land/x/js_yaml_port@3.14.0/js-yaml.js";

import date from "lume/plugins/date.ts";
import feed from "lume/plugins/feed.ts";
import inline from "lume/plugins/inline.ts";
import metas from "lume/plugins/metas.ts";
import minifyHTML from "lume/plugins/minify_html.ts";
import modifyUrls from "lume/plugins/modify_urls.ts";
import nav from "lume/plugins/nav.ts";
import resolveUrls from "lume/plugins/resolve_urls.ts";
import sass from "lume/plugins/sass.ts";
import sitemap from "lume/plugins/sitemap.ts";
import slugify_urls from "lume/plugins/slugify_urls.ts";

import toc from "https://deno.land/x/lume_markdown_plugins@v0.7.0/toc.ts";

import anchor from "npm:markdown-it-anchor";
import footnote from "npm:markdown-it-footnote";
import callouts from "npm:markdown-it-obsidian-callouts";

const markdown = {
    options: {
        breaks: false,
        linkify: true,
        xhtmlOut: true
    }, plugins: [
        callouts,
        [anchor, { level: 2 }],
        footnote,
    ]
};

interface Project {
    name: string;
    home: string;
    repo: string;
    logo: string;
    wordmark: string;
    description: string;
    draft: boolean;
}

// -------------------
// Foundation Data: submodule pages
// - foundation.json is generated by ./.github/lastmod.ts
// - foundation.yml  is manually maintained: descriptions, resulting page url, etc.
const FOUNDATION_DATA: Record<string, unknown> = safeLoad(Deno.readTextFileSync("./site/_includes/foundation.json"));
const FOUNDATION_PAGES: Record<string, unknown> = safeLoad(Deno.readTextFileSync("./site/_includes/foundation.yml"));
const PROJECT_DATA: Record<string, Project> = safeLoad(Deno.readTextFileSync("./site/foundation/PROJECTS.yaml"));

const mergeFoundationPageData = (page: Page, allPages: Page<Data>[]) => {
    // Called below when preprocessing html
    // (after markdown processing has occurred, but before the page is rendered to html)
    // 1. merge the data from the foundation.json and foundation.yml files
    // 2. set the date to a Date object
    // 3. set the title to the first H1 in the content if it hasn't been set
    // 4. if the page matches a bylaws entry (_data/bylaws.yml), set that ordinal as a page attribute

    const srcPath = page.src.path.replace("/foundation/", "");
    const metaData = FOUNDATION_DATA[srcPath + ".md"];
    const pageData = FOUNDATION_PAGES[srcPath];

    if (!pageData || !metaData) {
        // Skip/Remove any pages that don't have a corresponding entry in the foundation.yml file
        console.log("IGNORE: No page data for", srcPath);
        allPages.splice(allPages.indexOf(page), 1);
        return;
    }

    page.data = {
        ...page.data,
        ...metaData,
        ...pageData,
    };
    page.data.date = new Date(page.data.date);

    // If the title hasn't been set, set it to the first H1 in the content
    // Add the link to the github page based on the src path
    if (!page.data.title) {
        const content = page.data.content as string;
        const match = content.match(/#\s(.*)$/m); // 'm' flag for multiline
        if (match) {
            page.data.title = match[1];
        } else {
            page.data.title = page.data.basename;
        }
    }

    // Is this a page in the bylaws? Copy that ordinal into the page metadata if so
    const entry = page.data.bylaws.nav.find((x: { href: string }) => x.href === page.data.url);
    if (entry) {
        page.data.ord = entry.ord;
    }
};

const fixFoundationUrls = (url: string) => {
    if (url.startsWith('http') || url.startsWith('#')) {
        return url;
    }
    // Replace references to CONTACTS.yaml with the URL from the foundation repo
    if (url.includes('CONTACTS.yaml')) {
        return 'https://github.com/commonhaus/foundation/blob/main/CONTACTS.yaml';
    }
    // Replace references to project templates with the URL from the foundation repo
    if (url.includes('../../templates')) {
        return url.replace('../../templates', 'https://github.com/commonhaus/foundation/blob/main/templates');
    }
    // remaining links to CONTRIBUTING.md (from foundation materials) should point to the foundation repo
    if (url.includes('CONTRIBUTING.md')) {
        return 'https://github.com/commonhaus/foundation/blob/main/CONTRIBUTING.md';
    }
    // remaining links to CONTRIBUTING.md (from foundation materials) should point to the foundation repo
    if (url.includes('CODE_OF_CONDUCT.md')) {
        return 'https://github.com/commonhaus/foundation/blob/main/CODE_OF_CONDUCT.md';
    }
    return url;
};

// -------------------
// Site Configuration

const site = lume({
    src: "site",
    dest: "public",
    prettyUrls: false,
    location: new URL("https://www.commonhaus.org")
}, { markdown });

site.ignore("foundation/node_modules", "foundation/templates");

// Copy the content of "static" directory to the root of your site
site.copy("static", "/");
site.mergeKey("cssclasses", "stringArray");

site
    .use(date())
    .use(inline(/* Options */))
    .use(metas())
    .use(toc())
    .use(nav())
    .use(resolveUrls())
    .use(modifyUrls({
        fn: fixFoundationUrls
    }))
    .use(slugify_urls({
        extensions: [".html"],
        replace: {
            "&": "and",
            "@": "",
        },
    }))
    .use(sass({
        includes: "_includes/scss",
    }))
    .use(sitemap({
        query: "metas.robots!=false",
    }))
    .use(minifyHTML({
        options: {
            keep_closing_tags: true,
            keep_html_and_head_opening_tags: true,
        }
    }))
    .use(feed({
        output: ["/feed/index.rss", "/feed/index.json"],
        query: "post",
        limit: 10,
        info: {
            title: "=metas.site",
            description: "=description",
        },
        items: {
            title: "=rss-title",
            published: "=date",
            updated: "=updated",
        },
    }))
    .use(feed({
        output: ["/feed/notice.rss", "/feed/notice.json"],
        query: "post notice",
        limit: 10,
        info: {
            title: "=metas.site",
            description: "=description",
        },
        items: {
            title: "=rss-title",
            published: "=date",
            updated: "=updated",
        },
    }));

// Fixup attributes at build time if necessary
site.preprocess(['.md'], (pages) => {
    for (const page of pages) {
        if (typeof page.data.content !== "string") {
            continue;
        }
        if (/^\/activity\/\d/.test(page.src.path)) {
            page.data.cssclasses = page.data.cssclasses || [];
            page.data.cssclasses.push('activity', 'has-aside');
        }
        // add function to get list of projects
        page.data.listProjects = () => {
            return Object.values(PROJECT_DATA)
                .filter((project) => !project.draft);
        }
    }
});

site.preprocess([".html"], (filteredPages, allPages) => {
    for (const page of filteredPages) {

        if (page.src.path.startsWith("/foundation")) {
            mergeFoundationPageData(page, allPages);
        } else if (page.data.date && page.data.updated) {
            // For OTHER pages (actions, vote results),
            // set a boolean value if the updated date is different from the published date
            page.data.hasUpdate = page.data.date.toDateString() !== page.data.updated.toDateString();
        }
    }
});

site.filter("pageLock", (page: Page) => {
    let result = '';
    if (page.data.pinned) {
        result += `<span aria-label="pinned">${page.data.svg.pin}</span> `;
    }
    if (page.data.closedAt) {
        result += `<span aria-label="closed">${page.data.svg.closed}</span> `;
    }
    if (page.data.lockReason) {
        result += `<span aria-label="locked">${page.data.svg.lock}</span> `;
    }
    return result ? `<span class="act-status-icon">${result}</span>` : '';
});

site.filter("postLock", (data: Record<string, unknown>) => {
    let result = '';
    const svg = data.svg as any;
    if (data.pinned) {
        result += `<span aria-label="pinned">${svg.pin}</span> `;
    }
    if (data.closedAt) {
        result += `<span aria-label="closed">${svg.closed}</span> `;
    }
    if (data.lockReason) {
        result += `<span aria-label="locked">${svg.lock}</span> `;
    }
    return result ? `<span class="act-status-icon">${result}</span>` : `<span class="act-status-icon">${svg.blank}</span>`;
});

site.filter("testLock", (page: Page) => {
    return `<span class="act-status-icon">
    <span aria-label="pinned">${page.data.svg.pin}</span>
    <span aria-label="closed">${page.data.svg.closed}</span>
    <span aria-label="locked">${page.data.svg.lock}</span>
    </span>`;
});

site.filter("authorAvatar", (page: Page) => {
    const login = page.data.author;
    const author = page.data.authors[login];
    if (author) {
        return `<a class="avatar" href="${author.url}" target="_top">
            <img src="${author.avatar}" />
            <span>${login}</span>
        </a>`;
    } else {
        return `<div class="avatar">${login}</div>\n`;
    }
});

site.filter("listVoters", (voters: unknown) => {
    if (voters && Array.isArray(voters)) {
        return voters
            .map((voter: { login: string; url: string; }) =>
                 `<a href="${voter.url}" target="_top">${voter.login}</a>`)
            .join(", ");
    } else {
        console.log(voters, "is not an array");
    }
});


export default site;