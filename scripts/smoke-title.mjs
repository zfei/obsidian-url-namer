#!/usr/bin/env node

import process from "node:process";

const htmlTitlePattern = /<title[^>]*>\s*([\s\S]*?)\s*<\/title>/im;
const metaTagPattern = /<meta\b[^>]*>/gim;
const metaAttrPattern = /([a-zA-Z_:][a-zA-Z0-9:._-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
const NAMED_ENTITIES = {
  '&amp;': '&',
  '&apos;': "'",
  '&quot;': '"',
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' ',
};

export function unescapeHtmlEntities(text) {
  return (
    text
      // 1. Replace common named entities (case-insensitive)
      .replace(/&(amp|apos|quot|lt|gt|nbsp);/gi, (match) => {
        return NAMED_ENTITIES[match.toLowerCase()] ?? match;
      })
      // 2. Replace decimal numeric entities (e.g., &#39;, &#160;)
      .replace(/&#(\d+);/g, (_, dec) => {
        return String.fromCodePoint(Number(dec));
      })
      // 3. Replace hexadecimal numeric entities (e.g., &#x27;, &#xA0;)
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
        return String.fromCodePoint(parseInt(hex, 16));
      })
  );
}


function parseMetaTitle(body) {
	const metaTags = body.match(metaTagPattern);
	if (!metaTags) {
		return null;
	}

	for (const metaTag of metaTags) {
		const attrs = new Map();
		for (const match of metaTag.matchAll(metaAttrPattern)) {
			const key = match[1].toLowerCase();
			const value = (match[2] ?? match[3] ?? match[4] ?? "").trim();
			if (value.length > 0) {
				attrs.set(key, value);
			}
		}

		const property = (attrs.get("property") ?? attrs.get("name") ?? "").toLowerCase();
		if ((property === "og:title" || property === "twitter:title") && attrs.has("content")) {
			return attrs.get("content");
		}
	}

	return null;
}

function parseTitle(body) {
	const titleMatch = body.match(htmlTitlePattern);
	if (titleMatch && typeof titleMatch[1] === "string") {
		const htmlTitle = titleMatch[1].trim();
		if (htmlTitle.length > 0) {
			return htmlTitle;
		}
	}

	return parseMetaTitle(body);
}

const urlArg = process.argv[2];
if (!urlArg) {
	console.error("Usage: npm run smoke:title -- <url>");
	process.exit(1);
}

const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(urlArg);
const reqUrl = hasScheme
	? urlArg
	: `http://${urlArg}`;

try {
	const response = await fetch(reqUrl);
	const body = await response.text();
	const title = unescapeHtmlEntities(parseTitle(body));

	console.log(`Status: ${response.status}`);
	console.log(`URL: ${reqUrl}`);
	if (title) {
		console.log(`Title: ${title}`);
	} else {
		console.log("Title: <not found via <title>/og:title/twitter:title>");
	}
} catch (error) {
	console.error(`Request failed for ${reqUrl}: ${String(error)}`);
	process.exit(1);
}
