import express from "express";
import Parser from "rss-parser";
import RSS from "rss";
import { extract } from "@extractus/article-extractor";
import sanitizeHtml from "sanitize-html";

const app = express();
const parser = new Parser();

const FEEDS = [
  "https://code.facebook.com/posts/rss",
  "http://techblog.netflix.com/feeds/posts/default",
  "http://labs.spotify.com/feed/",
  "http://www.awsarchitectureblog.com/atom.xml",
  "https://slack.engineering/feed"
];

// Allowed tags and attributes for Kindle
const ALLOWED_TAGS = [
  "p", "br", "strong", "em", "b", "i", "u", "blockquote",
  "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
  "img", "a"
];
const ALLOWED_ATTRS = {
  a: ["href"],
  img: ["src", "alt"]
};

app.get("/", async (req, res) => {
  try {
    const mergedFeed = new RSS({
      title: "Kindle Feeds (Optimized)",
      description: "Full-text, Kindle-formatted engineering blogs",
      feed_url: `${req.protocol}://${req.get("host")}/`,
      site_url: "https://example.com",
      language: "en"
    });

    for (const url of FEEDS) {
      const feed = await parser.parseURL(url);
      for (const item of feed.items) {
        let fullContent = item.content || item.contentSnippet || "";

        try {
          const article = await extract(item.link);
          if (article?.content) {
            fullContent = article.content;
          }
        } catch (err) {
          console.error(`Full-text extraction failed for ${item.link}: ${err.message}`);
        }

        // Clean & format for Kindle
        let cleanContent = sanitizeHtml(fullContent, {
          allowedTags: ALLOWED_TAGS,
          allowedAttributes: ALLOWED_ATTRS,
          transformTags: {
            img: (tagName, attribs) => {
              // Ensure HTTPS for Kindle
              if (attribs.src && attribs.src.startsWith("//")) {
                attribs.src = "https:" + attribs.src;
              }
              return { tagName, attribs };
            }
          }
        });

        // Basic inline CSS for readability
        const kindleHTML = `
          <div style="font-family: serif; font-size: 1.1em; line-height: 1.5; margin: 0 5%;">
            ${cleanContent}
          </div>
        `;

        mergedFeed.item({
          title: item.title,
          description: kindleHTML,
          url: item.link,
          date: item.pubDate
        });
      }
    }

    res.type("application/rss+xml");
    res.send(mergedFeed.xml());
  } catch (err) {
    res.status(500).send(err.toString());
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Kindle-optimized RSS merger running on port ${PORT}`));
