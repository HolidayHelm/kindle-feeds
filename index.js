import express from "express";
import Parser from "rss-parser";
import RSS from "rss";
import { extract } from "@extractus/article-extractor";

const app = express();
const parser = new Parser();

const FEEDS = [
  "https://code.facebook.com/posts/rss",
  "http://techblog.netflix.com/feeds/posts/default",
  "http://labs.spotify.com/feed/",
  "http://www.awsarchitectureblog.com/atom.xml",
  "https://slack.engineering/feed"
];

app.get("/", async (req, res) => {
  try {
    const mergedFeed = new RSS({
      title: "Kindle Feeds (Full Text)",
      description: "Engineering blogs merged with full articles",
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
          console.error(`Failed to extract full text for ${item.link}:`, err.message);
        }

        mergedFeed.item({
          title: item.title,
          description: fullContent,
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
app.listen(PORT, () => console.log(`Full-text RSS merger running on port ${PORT}`));
