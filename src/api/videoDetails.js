import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: 'speedy-web-461014-g3',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

export const getVideoDetailsByCategory = async (category, startDate, endDate) => {
  try {
    // Define view thresholds for each category
    const categoryConditions = {
      megaVirals: 'mh.views >= 3000000',
      virals: 'mh.views >= 1000000 AND mh.views < 3000000',
      almostVirals: 'mh.views >= 500000 AND mh.views < 1000000',
      decentVideos: 'mh.views >= 100000 AND mh.views < 500000',
      flops: 'mh.views < 100000'
    };

    const condition = categoryConditions[category];
    if (!condition) {
      throw new Error(`Invalid category: ${category}`);
    }

    const query = `
      WITH latest_metadata AS (
        SELECT 
          video_id,
          views,
          snippet_title as title,
          snippet_published_at as published_date,
          snippet_thumbnails,
          ROW_NUMBER() OVER (PARTITION BY video_id ORDER BY date DESC) as rn
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.metadata_historical\`
        WHERE date BETWEEN @startDate AND @endDate
      ),
      previous_day_views AS (
        SELECT 
          video_id,
          views as previous_views,
          ROW_NUMBER() OVER (PARTITION BY video_id ORDER BY date DESC) as rn
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.metadata_historical\`
        WHERE date = DATE_SUB(@endDate, INTERVAL 1 DAY)
      ),
      video_with_urls AS (
        SELECT 
          mh.video_id,
          mh.views,
          mh.title,
          mh.published_date,
          mh.snippet_thumbnails,
          COALESCE(mh.views - pdv.previous_views, 0) as last_day_views,
          v.url,
          v.trello_card_id
        FROM latest_metadata mh
        LEFT JOIN previous_day_views pdv ON mh.video_id = pdv.video_id AND pdv.rn = 1
        LEFT JOIN \`speedy-web-461014-g3.postgres.video\` v 
          ON CONCAT('https://www.youtube.com/watch?v=', mh.video_id) LIKE CONCAT(SPLIT(v.url, '&')[OFFSET(0)], '%')
        WHERE mh.rn = 1
          AND ${condition}
      )
      SELECT 
        vwu.video_id,
        vwu.views,
        vwu.title,
        vwu.published_date,
        vwu.snippet_thumbnails,
        vwu.last_day_views,
        vwu.url,
        s.google_doc_link,
        s.ai_chat_url
      FROM video_with_urls vwu
      LEFT JOIN \`speedy-web-461014-g3.dbt_youtube_analytics.script\` s 
        ON vwu.trello_card_id = s.trello_card_id
      ORDER BY vwu.views DESC
      LIMIT 50
    `;

    const options = {
      query: query,
      params: {
        startDate: startDate,
        endDate: endDate
      },
      types: {
        startDate: 'DATE',
        endDate: 'DATE'
      }
    };

    const [rows] = await bigquery.query(options);
    
    return rows.map(row => ({
      video_id: row.video_id,
      views: row.views,
      title: row.title,
      published_date: row.published_date,
      snippet_thumbnails: row.snippet_thumbnails,
      last_day_views: row.last_day_views,
      url: row.url,
      google_doc_link: row.google_doc_link,
      ai_chat_url: row.ai_chat_url
    }));

  } catch (error) {
    console.error('Error fetching video details:', error);
    throw error;
  }
};

// API route handler for Next.js
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { category, startDate, endDate } = req.query;

    if (!category || !startDate || !endDate) {
      return res.status(400).json({ 
        message: 'Missing required parameters: category, startDate, endDate' 
      });
    }

    const videos = await getVideoDetailsByCategory(category, startDate, endDate);
    
    res.status(200).json({
      success: true,
      data: videos,
      count: videos.length
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch video details',
      error: error.message
    });
  }
}
