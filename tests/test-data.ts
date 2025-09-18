/**
 * テストデータ定義
 * DOPA競合企業情報とテスト用ニュースデータ
 */

export interface TestCompany {
  name: string;
  url: string;
  rssUrl: string;
}

export interface TestNewsArticle {
  companyId: string;
  title: string;
  titleJp: string;
  summaryJp: string;
  newsSummaryJp: string;
  importance: number;
  url: string;
  sourceUrls: Array<{
    url: string;
    title: string;
    source: string;
  }>;
}

export const TEST_COMPANIES: TestCompany[] = [
  {
    name: "The Pokémon Company International",
    url: "https://www.pokemon.com",
    rssUrl: "https://www.pokemon.com/us/pokemon-news/rss/"
  },
  {
    name: "DeNA Co., Ltd.",
    url: "https://dena.com",
    rssUrl: "https://dena.com/intl/news/"
  },
  {
    name: "Niantic, Inc.",
    url: "https://nianticlabs.com",
    rssUrl: "https://nianticlabs.com/blog/"
  }
];

export const TEST_NEWS_ARTICLES: TestNewsArticle[] = [
  {
    companyId: "pokemon_company",
    title: "Pokemon TCG Live Platform Updates",
    titleJp: "ポケモンTCG Liveプラットフォームアップデート",
    summaryJp: "ポケモン公式がTCG Liveプラットフォームの新機能を発表しました。デジタルカード取引機能が強化され、ユーザーエクスペリエンスが大幅に向上します。",
    newsSummaryJp: "【Pokemon】TCG Live新機能 - デジタルカード取引機能強化",
    importance: 88,
    url: "https://www.pokemon.com/us/pokemon-news/tcg-live-updates",
    sourceUrls: [
      {
        url: "https://www.pokemon.com/us/pokemon-news/tcg-live-updates",
        title: "Pokemon TCG Live Platform Updates",
        source: "Pokemon Official"
      }
    ]
  },
  {
    companyId: "dena_co",
    title: "Pokemon Trading Card Game Pocket New Features",
    titleJp: "ポケモンカードゲームポケット新機能",
    summaryJp: "DeNAがポケポケアプリの新機能をリリースしました。AR対戦機能とデジタルパック販売が開始され、モバイルゲーム体験が向上します。",
    newsSummaryJp: "【DeNA】ポケポケ新機能 - AR対戦とデジタルパック販売開始",
    importance: 82,
    url: "https://dena.com/intl/news/pokemon-pocket-update",
    sourceUrls: [
      {
        url: "https://dena.com/intl/news/pokemon-pocket-update",
        title: "Pokemon Trading Card Game Pocket New Features",
        source: "DeNA Official"
      }
    ]
  },
  {
    companyId: "niantic_inc",
    title: "Pokemon GO Plus+ Integration with TCG",
    titleJp: "Pokemon GO Plus+とTCGの統合",
    summaryJp: "NianticがPokemon GO Plus+とTCGの連携機能を発表しました。デジタルカード獲得機能が追加され、ARゲームとカードゲームの境界が曖昧になります。",
    newsSummaryJp: "【Niantic】Pokemon GO Plus+ TCG連携 - デジタルカード獲得機能",
    importance: 75,
    url: "https://nianticlabs.com/blog/pokemon-go-tcg-integration",
    sourceUrls: [
      {
        url: "https://nianticlabs.com/blog/pokemon-go-tcg-integration",
        title: "Pokemon GO Plus+ Integration with TCG",
        source: "Niantic Official"
      }
    ]
  }
];

export const TEST_CONTEXT = `デジタルカード・NFTプラットフォーム競合の動向を把握し、
自社（DOPA）の戦略立案に活用するため、
新プラットフォーム発表、パートナーシップ、技術革新、
ユーザー数・売上実績、規制対応、NFT市場動向を重視する。
個人情報やプライベートな投稿は除外する。`;

export const TEST_SLACK_CHANNEL = "#test-competitor-intelligence";

export const TEST_ERROR_USER = "@test-user";
