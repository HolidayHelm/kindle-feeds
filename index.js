process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Ignore bad certs

import express from "express";
import Parser from "rss-parser";
import { extract } from "@extractus/article-extractor";
import sanitizeHtml from "sanitize-html";
import { writeFileSync } from "fs";
import { execSync } from "child_process";
import nodemailer from "nodemailer";

const app = express();
const parser = new Parser();

const FEEDS = [
  "https://code.facebook.com/posts/rss",
  "https://techblog.netflix.com/feeds/posts/default",
  "https://labs.spotify.com/feed/",
  "https://www.awsarchitectureblog.com/atom.xml",
  "https://slack.engineering/feed"
];
const DAYS_BACK = 30;
const GMAIL_USER = "joshuareyesdevera@gmail.com";
const GMAIL_PASS = "zdwrnybnmzxrpaqs"; // Google App Password
const KINDLE_EMAIL = "joshuareyesdevera_5322@kindle.com";

// Calibre command (Render installs via apt)
const CALIBRE_CONVERT = "ebook-convert";

const ALLOWED_TAGS = [
  "p", "br", "strong", "em", "b", "i", "u", "blockquote",
  "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
  "img", "a"
];
const ALLOWED_ATTRS = { a: ["href"], img: ["src", "alt"] };

function sanitize(content) {
  return sanitizeHtml(content, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRS,
    transformTags: {
      img: (tagName, attribs) => {
        if (attribs.src && attribs.src.startsWith("//")) {
          attribs.src = "https:" + attribs.src;
        }
        return { tagName, attribs };
      }
    }
  });
}

async function generateAndSendEPUB() {
  let allArticles = [];
  const cutoff = Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000;

  for (const url of FEEDS) {
    try {
      const feed = await parser.parseURL(url);
      for (const item of feed.items) {
        const pubDate = item.pubDate ? new Date(item.pubDate).getTime() : null;
        if (!pubDate || pubDate < cutoff) continue;

        let fullContent = item.content || item.contentSnippet || "";
        try {
          const article = await extract(item.link);
          if (article?.content) fullContent = article.content;
        } catch (err) {
          console.warn(`⚠️ Could not extract: ${item.link} — ${err.message}`);
        }

        allArticles.push({
          title: item.title,
          date: pubDate,
          content: sanitize(fullContent)
        });
      }
    } catch (err) {
      console.warn(`⚠️ Could not fetch feed: ${url} — ${err.message}`);
    }
  }

  // Sort newest → oldest
  allArticles.sort((a, b) => b.date - a.date);

  // HTML with TOC chapters (h2 = chapter marker for Calibre)
  const htmlBody = `
    <html>
    <body style="font-family: serif; font-size: 1.1em; line-height: 1.5; margin: 5%;">
      <h1>Engineering Blogs – Past ${DAYS_BACK} Days</h1>
      <hr/>
      ${allArticles.map(a => `
        <h2>${a.title}</h2>
        <small>${new Date(a.date).toDateString()}</small>
        ${a.content}
        <hr/>
      `).join("\n")}
    </body>
    </html>
  `;

  writeFileSync("kindle.html", htmlBody);

  // Create timestamp for title & subject
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 16);

  // Convert HTML → EPUB with TOC
  execSync(`${CALIBRE_CONVERT} kindle.html kindle.epub \
    --title "Engineering Blogs – ${timestamp}" \
    --authors "RSS Merge" \
    --chapter "//h2" \
    --level1-toc "//h2" \
    --max-toc-links 999 \
    --toc-threshold 999`);

  // Email to Kindle
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER, pass: GMAIL_PASS }
  });

  await transporter.sendMail({
    from: GMAIL_USER,
    to: KINDLE_EMAIL,
    subject: `Engineering Blogs – ${timestamp}`,
    text: "Attached is the past month of engineering blog posts (EPUB).",
    attachments: [{ filename: "kindle.epub", path: "./kindle.epub" }]
  });

  console.log(`✅ Sent ${allArticles.length} articles as EPUB to Kindle!`);
}

app.get("/", async (req, res) => {
  await generateAndSendEPUB();
  res.send("✅ EPUB sent to Kindle");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server running");
});
