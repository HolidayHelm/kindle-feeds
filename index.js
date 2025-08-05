import express from "express";
import Parser from "rss-parser";
import RSS from "rss";

const app = express();
const parser = new Parser();

// Your Feedly feeds
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
      title: "Kindle Feeds",
      description: "Engineering blogs merged",
      feed_url: `${req.protocol}://${req.get("host")}/`,
      site_url: "https://example.com",
      language: "en"
    });

    for (const url of FEEDS) {
      const feed = await parser.parseURL(url);
      feed.items.forEach(item => {
        mergedFeed.item({
          title: item.title,
          description: item.content || item.contentSnippet,
          url: item.link,
          date: item.pubDate
        });
      });
    }

    res.type("application/rss+xml");
    res.send(mergedFeed.xml());
  } catch (err) {
    res.status(500).send(err.toString());
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`RSS merger running on port ${PORT}`));
