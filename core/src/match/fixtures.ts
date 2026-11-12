/**
 * FR-CORE-1's fixtures (generated 2026-11-08; build log step 5, decision e of step 1): the video titles
 * Bob copied by hand in Stages 6 and 7, each with its hand-checked answer. Only titles and answers are
 * here; no file from the private research folder is copied.
 * - "stage6": 106 titles from one uploader's list (2026-10-31); answers: rule v5's matches, hand-checked.
 * - "fresh": 42 titles from a second uploader (2026-11-07); answers: rule v6's run, hand-checked (v6 was tuned on them).
 * - "run2": 42 more titles from that uploader; answers: rule v6 frozen, hand-checked.
 * - "v7": the four videos Bob could not get named or fixed in Stage 9 (2026-11-09), each with the studio
 *   original MusicBrainz holds (checked on its API that day), and three titles whose 《》 holds a film,
 *   a show or an album and no song (written for the rework; they must stay silent or name the right song).
 * A match answer names the song, its credit and its first release as the hand check saw them.
 */
export interface MatchFixture {
  set: "stage6" | "fresh" | "run2" | "v7";
  title: string;
  answer: { song: string; credit: string; first?: string; recording_id?: string; check?: string } | { silent: string };
}

export const MATCH_FIXTURES: MatchFixture[] = [
 {
  "set": "stage6",
  "title": "百万级装备听《WAP》- Cardi B/Megan Thee Stallion【Hi-Res】",
  "answer": {
   "song": "WAP",
   "credit": "Cardi B feat. Megan Thee Stallion",
   "first": "2020-08-07",
   "recording_id": "3af602f0-e273-4d66-83c2-8d55243cc56b"
  }
 },
 {
  "set": "stage6",
  "title": "百万级装备听《LOVE.》- Kendrick Lamar, Zacari【Hi-Res】",
  "answer": {
   "silent": "no studio recording"
  }
 },
 {
  "set": "stage6",
  "title": "百万级装备试听 Paint The Town Red - Doja Cat 豆荚猫【Hi-Res】",
  "answer": {
   "song": "Paint the Town Red",
   "credit": "Doja Cat",
   "first": "2023-09-01",
   "recording_id": "b9e20829-1d09-456a-b649-3138e305d9ca"
  }
 },
 {
  "set": "stage6",
  "title": "百万级装备试听 Only One - Kanye West，Paul McCartney【Hi-Res】",
  "answer": {
   "silent": "no studio recording"
  }
 },
 {
  "set": "stage6",
  "title": "百万级装备试听 I Need a Doctor - Eminem，Dr. Dre，Skylar Grey【Hi-Res】",
  "answer": {
   "silent": "no studio recording"
  }
 },
 {
  "set": "stage6",
  "title": "百万级装备试听 Barbie World (with Aqua) - Nicki Minaj，Ice Spice【Hi-Res】",
  "answer": {
   "silent": "no studio recording"
  }
 },
 {
  "set": "stage6",
  "title": "麻辣鸡新单试听 Last Time I Saw You - Nicki Minaj 妮琪·米娜【Hi-Res】",
  "answer": {
   "song": "Last Time I Saw You",
   "credit": "Nicki Minaj",
   "first": "2023-12-08",
   "recording_id": "8210a53c-cccf-456d-bab1-f9ca8987cb74"
  }
 },
 {
  "set": "stage6",
  "title": "百万级装备试听The Monster - Eminem，Rihanna【Hi-Res】",
  "answer": {
   "song": "The Monster",
   "credit": "Eminem ft. Rihanna",
   "first": "2013",
   "recording_id": "7e9e29c6-c643-41bb-bd1c-f77e4a453719"
  }
 },
 {
  "set": "stage6",
  "title": "「Ye! 」Flashing Lights - Kanye West, Dwele 百万级装备试听【Hi-Res】",
  "answer": {
   "song": "Flashing Lights",
   "credit": "Kanye West feat. Dwele",
   "first": "2007",
   "recording_id": "078c6b81-8e6c-4403-accf-c634b742143c"
  }
 },
 {
  "set": "stage6",
  "title": "「马龙」Better Now - Post Malone 百万级装备试听【Hi-Res】",
  "answer": {
   "song": "Better Now",
   "credit": "Post Malone",
   "first": "2018-04-27",
   "recording_id": "6d75e581-54a5-4e7c-a22c-8a31c274406c"
  }
 },
 {
  "set": "stage6",
  "title": "「公鸭」God's Plan - Drake 德雷克 百万级装备试听【Hi-Res】",
  "answer": {
   "song": "God’s Plan",
   "credit": "Drake",
   "first": "2018-01-19",
   "recording_id": "7bc3d832-09fb-4e57-a266-fd8cfa15b6f3"
  }
 },
 {
  "set": "stage6",
  "title": "「春丽」Chun-Li - Nicki Minaj 妮琪·米娜 百万级装备试听【Hi-Res】",
  "answer": {
   "song": "Chun‐Li",
   "credit": "Nicki Minaj",
   "first": "2018-04-12",
   "recording_id": "a2e25a97-9c17-4462-987e-26916f9b58ae"
  }
 },
 {
  "set": "stage6",
  "title": "「豆荚猫猫」Agora Hills - Doja Cat  百万级装备试听【Hi-Res】",
  "answer": {
   "song": "Agora Hills",
   "credit": "Doja Cat",
   "first": "2023-09-22",
   "recording_id": "acc7790a-dff9-40c1-ab5c-72d601e45bba"
  }
 },
 {
  "set": "stage6",
  "title": "「Ye!」Devil In A New Dress - Kanye West, Rick Ross 百万级装备试听【Hi-Res】",
  "answer": {
   "song": "Devil in a New Dress",
   "credit": "Kanye West feat. Rick Ross",
   "first": "2010",
   "recording_id": "c8da6e46-d517-4930-87d8-5be5ab9ca3c9"
  }
 },
 {
  "set": "stage6",
  "title": "「摇滚明星」rockstar - Post Malone，21 Savage 百万级装备试听【Hi-Res】",
  "answer": {
   "silent": "no studio recording"
  }
 },
 {
  "set": "stage6",
  "title": "「ye能量」Power - Kanye West 百万级装备试听【Hi-Res】",
  "answer": {
   "song": "Power",
   "credit": "Kanye West",
   "first": "2010",
   "recording_id": "f42e84ef-f23e-4b8c-b3a1-8f407be68ea5"
  }
 },
 {
  "set": "stage6",
  "title": "「姆爷+黄老板」River - Eminem, Ed Sheeran 百万级装备试听【Hi-Res】",
  "answer": {
   "song": "River",
   "credit": "Eminem feat. Ed Sheeran",
   "first": "2017-12-15",
   "recording_id": "32d6bfe9-b231-4d5f-9034-61226f7d7d96"
  }
 },
 {
  "set": "stage6",
  "title": "「饶舌女王」Needle - Nicki Minaj,  Drake 百万级装备试听【Hi-Res】",
  "answer": {
   "silent": "no studio recording"
  }
 },
 {
  "set": "stage6",
  "title": "「Damn~~~」Slime You Out - Drake,  SZA 百万级装备试听【Hi-Res】",
  "answer": {
   "song": "Slime You Out",
   "credit": "Drake feat. SZA",
   "first": "2023-11-17",
   "recording_id": "6de2f585-8b5d-47b9-8168-d6d583ba85bc"
  }
 },
 {
  "set": "stage6",
  "title": "「李娜叉」J CHRIST - Lil Nas X 百万级装备试听【Hi-Res】",
  "answer": {
   "song": "J CHRIST",
   "credit": "Lil Nas X",
   "first": "",
   "recording_id": "099bf20c-7b1b-4b5a-a9d8-08d070ee5cbe"
  }
 },
 {
  "set": "stage6",
  "title": "为什么MJ一开口我就跪下了？Don't Matter To Me - Drake, Michael Jackson 百万级装备试听【Hi-Res】",
  "answer": {
   "silent": "no candidate"
  }
 },
 {
  "set": "stage6",
  "title": "「继承之战」L to the OG (feat. Kendall Roy)  百万级装备试听【Hi-Res】",
  "answer": {
   "song": "L to the OG",
   "credit": "Nicholas Britell feat. Kendall Roy",
   "first": "2020-05-22",
   "recording_id": "cb92ad93-9251-47f0-b77b-61d7c8a90762"
  }
 },
 {
  "set": "stage6",
  "title": "「还能说什么呢」Her - Megan Thee Stallion 梅根 百万级装备试听【Hi-Res】",
  "answer": {
   "song": "Her",
   "credit": "Megan Thee Stallion",
   "first": "2022-08",
   "recording_id": "fa0f87a5-4de1-44c6-99e6-5993e5dddeae"
  }
 },
 {
  "set": "stage6",
  "title": "「麻辣鸡开炮」Big Foot - Nicki Minaj 妮琪·米娜 百万级装备试听【Hi-Res】",
  "answer": {
   "song": "Big Foot",
   "credit": "Nicki Minaj",
   "first": "",
   "recording_id": "aae5779e-11da-4134-ae52-17245bbda19b"
  }
 },
 {
  "set": "stage6",
  "title": "「马冬梅还能说什么呢」HISS - Megan Thee Stallion 百万级装备试听【Hi-Res】",
  "answer": {
   "song": "HISS",
   "credit": "Megan Thee Stallion",
   "first": "2024",
   "recording_id": "5cec1da5-3249-4d46-abe5-050b937e39bc"
  }
 },
 {
  "set": "stage6",
  "title": "「芝加哥即兴」Chicago Freestyle - Drake,  Giveon 百万级装备试听【Hi-Res】",
  "answer": {
   "song": "Chicago Freestyle",
   "credit": "Drake feat. Givēon Evans",
   "first": "",
   "recording_id": "91d78d25-ff37-4a55-a51b-c1d03d682985"
  }
 },
 {
  "set": "stage6",
  "title": "「Emo宝藏」All Girls Are The Same - Juice WRLD 百万级装备试听【Hi-Res】",
  "answer": {
   "silent": "the same record holds versions released months apart"
  }
 },
 {
  "set": "stage6",
  "title": "「宝藏嘻哈」Ric Flair Drip - Offset, Metro Boomin 百万级装备试听【Hi-Res】",
  "answer": {
   "song": "Ric Flair Drip",
   "credit": "Offset & Metro Boomin",
   "first": "2018-03-01",
   "recording_id": "b82fd142-d87e-4cf6-a2fd-ae55dd20a118"
  }
 },
 {
  "set": "stage6",
  "title": "「侃爷嘉年华」CARNIVAL - ¥$/Kanye West/Ty Dolla $ign 百万级装备试听【Hi-Res】",
  "answer": {
   "silent": "no studio recording"
  }
 },
 {
  "set": "stage6",
  "title": "「义乌小曲」The Box - Roddy Ricch 罗迪·里奇 百万级装备试听【Hi-Res】",
  "answer": {
   "song": "The Box",
   "credit": "Roddy Ricch",
   "first": "2019-12-06",
   "recording_id": "3e0b00ff-275f-4472-91b3-df760c8be195"
  }
 },
 {
  "set": "stage6",
  "title": "说唱圈一瓜又一瓜，来自Kendrick Lamar的回应，euphoria（亢奋）",
  "answer": {
   "silent": "no candidate"
  }
 },
 {
  "set": "stage6",
  "title": "「参见格雷汉姆一家」meet the grahams 大呼过瘾，来自Kendrick Lamar的降维打击",
  "answer": {
   "silent": "no candidate"
  }
 },
 {
  "set": "stage6",
  "title": "「姆爷回归 爷就是爷」Houdini - Eminem 埃米纳姆",
  "answer": {
   "song": "Houdini",
   "credit": "Eminem",
   "first": "2024-05-31",
   "recording_id": "7bf0cb56-212f-4fdb-b68c-04d3059d68c7"
  }
 },
 {
  "set": "stage6",
  "title": "「不听会后悔」HOPE - NF",
  "answer": {
   "song": "HOPE",
   "credit": "NF",
   "first": "2023-02-16",
   "recording_id": "9fe4c7af-0ec4-48d7-9627-b7b3242095ab"
  }
 },
 {
  "set": "stage6",
  "title": "「蜘蛛侠：纵横宇宙｜百万级装备试听」Self Love - Metro Boomin，Coi Leray",
  "answer": {
   "silent": "no candidate"
  }
 },
 {
  "set": "stage6",
  "title": "「恭喜冠军烤鸭｜烤鸭年年有 今年特别香」Not Like Us - Kendrick Lamar 肯德里克·拉马尔",
  "answer": {
   "song": "Not Like Us",
   "credit": "Kendrick Lamar",
   "first": "2024-05-04",
   "recording_id": "167b0a18-8923-4f64-82dd-30fb57e6216f"
  }
 },
 {
  "set": "stage6",
  "title": "「爆火妖单｜百万美元宝贝」MILLION DOLLAR BABY - Tommy Richman",
  "answer": {
   "song": "MILLION DOLLAR BABY",
   "credit": "Tommy Richman",
   "first": "2024-04-26",
   "recording_id": "a5dc8229-2b09-47eb-89bc-4bdf6fc83f01"
  }
 },
 {
  "set": "stage6",
  "title": "「侃爷 VULTURES 2」530 - ¥$，Kanye West，Ty Dolla $ign",
  "answer": {
   "song": "530",
   "credit": "¥$",
   "first": "2024-11-10",
   "recording_id": "eadac8ca-4f7d-445e-922e-454cb76c2d50"
  }
 },
 {
  "set": "stage6",
  "title": "「宝藏神曲｜如果生命只剩最后一天，你会怎么过？」LAst DAy oN EaRTh - Tai Verdes",
  "answer": {
   "song": "LAst dAy oN EaRTh",
   "credit": "Tai Verdes",
   "first": "2022-01-13",
   "recording_id": "f6e12d74-4468-4e68-9c79-d48d6fa69cb6"
  }
 },
 {
  "set": "stage6",
  "title": "「埃米纳姆｜最新催泪MV」Eminem - Somebody Save Me (feat. Jelly Roll) [Official Music Video]",
  "answer": {
   "song": "Somebody Save Me",
   "credit": "Eminem feat. Jelly Roll",
   "first": "2024-07-12",
   "recording_id": "9f4c8972-4c4e-4bf7-9dd9-0ca3e0d408cc"
  }
 },
 {
  "set": "stage6",
  "title": "「侃爷 VULTURES 2」RIVER - ¥$，Kanye West，Ty Dolla $ign",
  "answer": {
   "song": "RIVER",
   "credit": "¥$",
   "first": "2024-11-10",
   "recording_id": "92671b23-009c-494d-873f-d7b5b901eaa2"
  }
 },
 {
  "set": "stage6",
  "title": "「鸭鸭爆单」In My Feelings - Drake 德雷克",
  "answer": {
   "song": "In My Feelings",
   "credit": "Drake",
   "first": "2018-06-29",
   "recording_id": "dd6c0aa4-9b13-45e3-bac9-6f45f7c0607d"
  }
 },
 {
  "set": "stage6",
  "title": "「皇后+马冬梅」We Will Rock You (Megan Thee Stallion Version)",
  "answer": {
   "silent": "no studio recording"
  }
 },
 {
  "set": "stage6",
  "title": "「Kanye + Sia 超棒合作曲」Wolves - Kanye West，Vic Mensa，Sia",
  "answer": {
   "silent": "only clean edits"
  }
 },
 {
  "set": "stage6",
  "title": "百万级装备试听YOSEMITE - Travis Scott【Hi-Res】",
  "answer": {
   "song": "YOSEMITE",
   "credit": "Travis Scott",
   "first": "2018-08-03",
   "recording_id": "1892f310-8713-47e5-b9a8-06f8d4021ca9"
  }
 },
 {
  "set": "stage6",
  "title": "「卡子新单」Enough (Miami) - Cardi B 卡迪·碧 百万级装备试听【Hi-Res】",
  "answer": {
   "song": "Enough (Miami)",
   "credit": "Cardi B",
   "first": "2024-03-15",
   "recording_id": "d3f4cf57-bb80-4a39-ab3a-0ebaca55f4a9"
  }
 },
 {
  "set": "stage6",
  "title": "「喇嘛+诗莎」 luther - Kendrick Lamar，SZA",
  "answer": {
   "song": "luther",
   "credit": "Kendrick Lamar with SZA",
   "first": "2024-11-22",
   "recording_id": "ac19684f-febb-47ae-8d5f-72a4c4c1aa3d"
  }
 },
 {
  "set": "stage6",
  "title": "「比伯｜最新旧单」Honest - Justin Bieber，Don Toliver",
  "answer": {
   "song": "Honest",
   "credit": "Justin Bieber feat. Don Toliver",
   "first": "2022-04-29",
   "recording_id": "c6686001-03b1-40c5-b167-ddaf16e1476b"
  }
 },
 {
  "set": "stage6",
  "title": "「Drake新专｜兄弟抱一下」GIMME A HUG - Drake",
  "answer": {
   "song": "GIMME A HUG",
   "credit": "Drake",
   "first": "",
   "recording_id": "7f3fccf0-8416-40d1-9cd0-9f8f2353e965"
  }
 },
 {
  "set": "stage6",
  "title": "「豆豉新单｜采样Somebody That I Used To Know」Anxiety - Doechii",
  "answer": {
   "song": "Anxiety",
   "credit": "Doechii",
   "first": "2025-03-05",
   "recording_id": "43d7be59-74d3-409f-a8b8-59636354e64c"
  }
 },
 {
  "set": "stage6",
  "title": "「GTA电台｜1982年的嘻哈｜典中典」The Message - Grandmaster Flash & the Furious Five",
  "answer": {
   "silent": "no studio recording"
  }
 },
 {
  "set": "stage6",
  "title": "「侃爷｜缀学熊三部曲」I Wonder - Kanye West/Ye/坎耶·维斯特",
  "answer": {
   "song": "I Wonder",
   "credit": "Kanye West",
   "first": "2007",
   "recording_id": "b3a7eae7-1515-45ae-8ca1-ee05544e8965"
  }
 },
 {
  "set": "stage6",
  "title": "「侃爷｜ye」I Violent Crimes - Kanye West/Nicki Minaj",
  "answer": {
   "silent": "no candidate"
  }
 },
 {
  "set": "stage6",
  "title": "「侃爷｜DONDA 2」I TRUE LOVE - Kanye West/xxxtentacion",
  "answer": {
   "silent": "no candidate"
  }
 },
 {
  "set": "stage6",
  "title": "「卡迪碧新单」Imaginary Playerz - Cardi B",
  "answer": {
   "song": "Imaginary Playerz",
   "credit": "Cardi B",
   "first": "2025-08-15",
   "recording_id": "9d48ee7f-3491-4369-b831-cea65a37a5e5"
  }
 },
 {
  "set": "stage6",
  "title": "「浦西说｜城市姐妹+豆荚猫」P＊＊＊y talk - City Girls，Doja Cat",
  "answer": {
   "silent": "only clean edits"
  }
 },
 {
  "set": "stage6",
  "title": "「只见鸭名 未闻鸭声」4422 - Drake，Sampha",
  "answer": {
   "silent": "no studio recording"
  }
 },
 {
  "set": "stage6",
  "title": "「侃爷/Kanye/Ye/YeYe」Monster - Kanye West，Bon Iver，JAY-Z，Nicki Minaj，Rick Ross",
  "answer": {
   "silent": "no studio recording"
  }
 },
 {
  "set": "stage6",
  "title": "「掌管西海岸的神」California Love (Original Version) - 2Pac，Roger，Dr. Dre",
  "answer": {
   "silent": "no studio recording"
  }
 },
 {
  "set": "stage6",
  "title": "「卡迪·碧新专｜AM I THE DRAMA?」Safe - Cardi B，Kehlani",
  "answer": {
   "song": "Safe",
   "credit": "Cardi B feat. Kehlani",
   "first": "2025-09-19",
   "recording_id": "3c5b6032-18ae-4ebd-a50f-60da565bf317"
  }
 },
 {
  "set": "stage6",
  "title": "百万级装备试听All Of The Lights - Kanye West, Rihanna, Kid Cudi, Fergie【Hi-Res】",
  "answer": {
   "song": "All of the Lights",
   "credit": "Kanye West",
   "first": "2010",
   "recording_id": "a4c4457b-577e-4fac-b820-713bb91dbb6c"
  }
 },
 {
  "set": "stage6",
  "title": "「Up」来了 - Cardi B 卡迪·B【Hi-Res】",
  "answer": {
   "silent": "no candidate"
  }
 },
 {
  "set": "stage6",
  "title": "百万级装备试听WHERE SHE GOES - Bad Bunny【Hi-Res】",
  "answer": {
   "song": "WHERE SHE GOES",
   "credit": "Bad Bunny",
   "first": "2023-10-13",
   "recording_id": "9452c07b-d144-428b-b3f1-24ea3bc7001d"
  }
 },
 {
  "set": "stage6",
  "title": "百万级装备试听Empire State Of Mind - JAY-Z, Alicia Keys【Hi-Res】",
  "answer": {
   "song": "Empire State of Mind",
   "credit": "Jay‐Z + Alicia Keys",
   "first": "2009-09-08",
   "recording_id": "4a9818ba-5963-4761-864f-7d96841053d2"
  }
 },
 {
  "set": "stage6",
  "title": "百万级装备试听EARFQUAKE - Tyler, The Creator【Hi-Res】",
  "answer": {
   "song": "EARFQUAKE",
   "credit": "Tyler, The Creator",
   "first": "2019-05-17",
   "recording_id": "b9648e9e-e8b9-4db1-943e-eb1f6db72257"
  }
 },
 {
  "set": "stage6",
  "title": "百万级装备试听Old Town Road (Remix) - Lil Nas X，Billy Ray Cyrus【Hi-Res】",
  "answer": {
   "song": "Old Town Road (remix)",
   "credit": "Lil Nas X feat. Billy Ray Cyrus",
   "first": "2019",
   "recording_id": "d89febab-647a-4403-a157-1b25c515ab24"
  }
 },
 {
  "set": "stage6",
  "title": "百万级装备试听Passionfruit - Drake【Hi-Res】",
  "answer": {
   "song": "Passionfruit",
   "credit": "Drake",
   "first": "2017-03-28",
   "recording_id": "8eccc484-bba1-4ca0-8600-41c8be9976a9"
  }
 },
 {
  "set": "stage6",
  "title": "百万级装备试听Super Freaky Girl - Nicki Minaj 妮琪·米娜【Hi-Res】",
  "answer": {
   "song": "Super Freaky Girl",
   "credit": "Nicki Minaj",
   "first": "2023-12-08",
   "recording_id": "ec81e381-c77a-4eb6-a237-fbd0e7d6038f"
  }
 },
 {
  "set": "stage6",
  "title": "百万级装备试听Stan - Eminem，Dido【Hi-Res】",
  "answer": {
   "silent": "different artists"
  }
 },
 {
  "set": "stage6",
  "title": "百万级装备试听 Heartless - Kanye West【Hi-Res】",
  "answer": {
   "song": "Heartless",
   "credit": "Kanye West",
   "first": "2008",
   "recording_id": "986077d0-162b-43b3-b8ff-514cfd774eba"
  }
 },
 {
  "set": "stage6",
  "title": "百万级装备试听 Ghost Town - Kanye West， PARTYNEXTDOOR【Hi-Res】",
  "answer": {
   "song": "Ghost Town",
   "credit": "Kanye West feat. PARTYNEXTDOOR",
   "first": "2018",
   "recording_id": "69a96bec-b69c-482a-95fc-40dfde41f0b2"
  }
 },
 {
  "set": "stage6",
  "title": "百万级装备试听 Bound 2 - Kanye West, Charlie Wilson【Hi-Res】",
  "answer": {
   "song": "Bound 2",
   "credit": "Kanye West",
   "first": "2013-06-18",
   "recording_id": "d823ad32-96ee-4ff0-9653-b99c4d39310a"
  }
 },
 {
  "set": "stage6",
  "title": "1-800-273-8255 - Logic, Alessia Cara, Khalid【Hi-Res】百万级装备试听",
  "answer": {
   "song": "1‒800‒273‒8255",
   "credit": "Logic feat. Alessia Cara & Khalid",
   "first": "2017-04-27",
   "recording_id": "f9e961f9-36b9-4202-8a46-f649c7ef75d3"
  }
 },
 {
  "set": "stage6",
  "title": "All The Stars《黑豹》插曲 - Kendrick Lamar, SZA【Hi-Res】百万级装备试听",
  "answer": {
   "silent": "no candidate"
  }
 },
 {
  "set": "stage6",
  "title": "Luv(sic.), Pt. 4，5，Grand Finale - Nujabes，Shing02【Hi-Res】百万级装备试听",
  "answer": {
   "silent": "no candidate"
  }
 },
 {
  "set": "stage6",
  "title": "Love The Way You Lie - Eminem, Rihanna【Hi-Res】百万级装备试听",
  "answer": {
   "song": "Love the Way You Lie",
   "credit": "Eminem feat. Rihanna",
   "first": "2010",
   "recording_id": "29d6a30b-b911-475c-808c-8b289844ca75"
  }
 },
 {
  "set": "stage6",
  "title": "Lose Yourself - Eminem 埃米纳姆【Hi-Res】百万级装备试听",
  "answer": {
   "song": "Lose Yourself",
   "credit": "Eminem",
   "first": "2002",
   "recording_id": "588a6833-7a02-4801-8de1-e3824fae5960"
  }
 },
 {
  "set": "stage6",
  "title": "Stronger - Kanye West，Daft Punk【Hi-Res】百万级装备试听",
  "answer": {
   "song": "Stronger",
   "credit": "Kanye West",
   "first": "2007",
   "recording_id": "8009d470-912b-42fa-8261-b88c488eb935"
  }
 },
 {
  "set": "stage6",
  "title": "Let Go - Beau Young Prince【Hi-Res】百万级装备试听",
  "answer": {
   "song": "Let Go",
   "credit": "Beau Young Prince",
   "first": "2018-12-14",
   "recording_id": "6333f8a8-7b99-4c7d-a8ad-6cce9f4b3656"
  }
 },
 {
  "set": "stage6",
  "title": "百万级装备听《Self Control》- Frank Ocean【Hi-Res】",
  "answer": {
   "song": "Self Control",
   "credit": "Frank Ocean",
   "first": "2016-08-20",
   "recording_id": "039326dc-e853-4de8-84c5-dd91c31d4256"
  }
 },
 {
  "set": "stage6",
  "title": "百万级装备听《Sunflower》- Post Malone，Swae Lee【Hi-Res】",
  "answer": {
   "silent": "no studio recording"
  }
 },
 {
  "set": "stage6",
  "title": "百万级装备听《Toosie Slide》 - Drake【Hi-Res】",
  "answer": {
   "song": "Toosie Slide",
   "credit": "Drake",
   "first": "2020-04-03",
   "recording_id": "de4c54c9-6171-4cec-8866-d5f41b24d51d"
  }
 },
 {
  "set": "stage6",
  "title": "百万级装备听《Hurricane》- Kanye West，The Weeknd，Lil Baby【Hi-Res】",
  "answer": {
   "song": "Hurricane",
   "credit": "Kanye West",
   "first": "2021-09-28",
   "recording_id": "68f3572e-96c2-4080-8d53-03c91e67d647"
  }
 },
 {
  "set": "stage6",
  "title": "百万级装备《Street Lights》- Kanye West【Hi-Res】",
  "answer": {
   "song": "Street Lights",
   "credit": "Kanye West",
   "first": "2008",
   "recording_id": "62ff96c2-e173-41eb-875b-061ccf7c339c"
  }
 },
 {
  "set": "stage6",
  "title": "百万级装备听《Luv (sic) Part. 1 - 3 》- Nujabes (feat Shing02)【Hi-Res】",
  "answer": {
   "silent": "no candidate"
  }
 },
 {
  "set": "stage6",
  "title": "百万级装备听《Runaway》- Kanye West, Pusha T 【Hi-Res】",
  "answer": {
   "silent": "no studio recording"
  }
 },
 {
  "set": "stage6",
  "title": "百万级装备试听Frank Ocean《Pink + White》【Hi-Res】",
  "answer": {
   "song": "Pink + White",
   "credit": "Frank Ocean",
   "first": "2016-08-20",
   "recording_id": "d90934be-302a-4e0d-a1dd-b94df3421f33"
  }
 },
 {
  "set": "stage6",
  "title": "百万级豪华装备试听法海Frank Ocean《White Ferrari》【Hi-Res】",
  "answer": {
   "song": "White Ferrari",
   "credit": "Frank Ocean",
   "first": "2016-08-20",
   "recording_id": "a1f25623-f56c-4f36-bcce-67488d04e7cc"
  }
 },
 {
  "set": "stage6",
  "title": "百万级豪华装备试听侃爷Kanye West《Come to Life》【Hi-Res】",
  "answer": {
   "song": "Come to Life",
   "credit": "Kanye West",
   "first": "2021-09-28",
   "recording_id": "a1b15e3e-b48c-4300-a663-19ce8cc777f0"
  }
 },
 {
  "set": "stage6",
  "title": "用百万级豪华装备试听侃爷Kanye West《Moon》【Hi-Res】",
  "answer": {
   "song": "Moon",
   "credit": "Kanye West",
   "first": "2021-09-28",
   "recording_id": "dd97d168-bc9f-4989-9575-efb822961d47"
  }
 },
 {
  "set": "stage6",
  "title": "「卡迪·碧新专｜AM I THE DRAMA?」Dead - Cardi B，Summer Walker",
  "answer": {
   "song": "Dead",
   "credit": "Cardi B feat. Summer Walker",
   "first": "2025-09-18",
   "recording_id": "197359bf-f515-4f8d-9df1-86d1d691a6e0"
  }
 },
 {
  "set": "stage6",
  "title": "「NF｜全新EP」FEAR - NF (Nate Feuerstein)",
  "answer": {
   "silent": "no candidate"
  }
 },
 {
  "set": "stage6",
  "title": "「豆豉+诗莎合作新单｜姐姐妹妹站起来」girl, get up - Doechii，SZA",
  "answer": {
   "song": "girl, get up.",
   "credit": "Doechii & SZA",
   "first": "2025-12-30",
   "recording_id": "3ea520d6-e3a6-478b-a184-8121ded06f16"
  }
 },
 {
  "set": "stage6",
  "title": "「盆盆鸭」Shot For Me - Drake",
  "answer": {
   "song": "Shot for Me",
   "credit": "Drake",
   "first": "2011-11-14",
   "recording_id": "38a0fa66-4976-4fe2-8afa-40acf3dfe567"
  }
 },
 {
  "set": "stage6",
  "title": "「A$AP Rocky新专｜Don't Be Dumb」STAY HERE 4 LIFE",
  "answer": {
   "silent": "no candidate"
  }
 },
 {
  "set": "stage6",
  "title": "「黑眼豆豆」My Humps - Black Eyed Peas",
  "answer": {
   "song": "My Humps",
   "credit": "The Black Eyed Peas",
   "first": "2005",
   "recording_id": "859663e0-0b03-42ff-8364-14b7f50e04f0"
  }
 },
 {
  "set": "stage6",
  "title": "「豆荚猫｜F1」Lose My Mind - Don Toliver，Doja Cat",
  "answer": {
   "song": "Lose My Mind",
   "credit": "Don Toliver feat. Doja Cat",
   "first": "2025-06-26",
   "recording_id": "0e2367b4-97f0-4115-ab61-9355d176bcbf"
  }
 },
 {
  "set": "stage6",
  "title": "「真爱降临」Scared 2 Be Lonely - Lil Tjay 利·杰伊",
  "answer": {
   "song": "Scared 2 Be Lonely",
   "credit": "Lil Tjay",
   "first": "",
   "recording_id": "a3f58ff3-6889-44c4-a303-71d64c7669c1"
  }
 },
 {
  "set": "stage6",
  "title": "「泰勒造物主」Ring Ring Ring - Tyler, The Creator",
  "answer": {
   "song": "Ring Ring Ring",
   "credit": "Tyler, The Creator",
   "first": "2025-07-21",
   "recording_id": "1726498a-93a4-4625-92b8-ffbba651d62e"
  }
 },
 {
  "set": "stage6",
  "title": "「Kanye West/Ye/Ye Ye新专｜Bully」ALL THE LOVE (feat. Andre Troutman)",
  "answer": {
   "song": "ALL THE LOVE",
   "credit": "Ye",
   "first": "2026-03-24",
   "recording_id": "e0df3c44-27b6-4bd8-b87e-143d2c86044a"
  }
 },
 {
  "set": "stage6",
  "title": "「Kanye West/Ye/Ye Ye新专｜Bully」LAST BREATH (feat. Peso Pluma)",
  "answer": {
   "song": "LAST BREATH",
   "credit": "Ye",
   "first": "2026-03-24",
   "recording_id": "3a19c4f2-718f-412f-8078-01e248adb2c7"
  }
 },
 {
  "set": "stage6",
  "title": "「Drake新专｜ICEMAN」Make Them Cry - Drake",
  "answer": {
   "song": "Make Them Cry",
   "credit": "Drake",
   "first": "2026-05-15",
   "recording_id": "23478b23-7898-4c08-b162-69e775fc109a"
  }
 },
 {
  "set": "stage6",
  "title": "「Drake新专｜ICEMAN」What Did I Miss? - Drake",
  "answer": {
   "silent": "the same record holds versions released months apart"
  }
 },
 {
  "set": "stage6",
  "title": "「Drak｜ICEMAN」Make Them Know - Drake",
  "answer": {
   "song": "Make Them Know",
   "credit": "Drake",
   "first": "2026-05-15",
   "recording_id": "c2897881-db9b-4928-b307-d518cf342763"
  }
 },
 {
  "set": "stage6",
  "title": "「小众仙品」On My Own - Ollie",
  "answer": {
   "silent": "no candidate"
  }
 },
 {
  "set": "stage6",
  "title": "「特别好听」How To Pray - Dahi, Kendrick Lamar, Amber Mark",
  "answer": {
   "song": "How to Pray",
   "credit": "Dahi feat. Kendrick Lamar & Amber Mark",
   "first": "2026-08-28",
   "recording_id": "14553ba5-b005-403f-8f35-211871702dc8"
  }
 },
 {
  "set": "fresh",
  "title": "容祖儿《连续剧（电视剧《On Call 36小时》主题曲）》百万豪装录音棚大声听",
  "answer": {
   "silent": "no studio recording"
  }
 },
 {
  "set": "fresh",
  "title": "浅影啊《牡丹亭》百万豪装录音棚大声听",
  "answer": {
   "silent": "no candidate"
  }
 },
 {
  "set": "fresh",
  "title": "叶倩文《潇洒走一回》百万豪装录音棚大声听",
  "answer": {
   "silent": "no studio recording"
  }
 },
 {
  "set": "fresh",
  "title": "迪克牛仔《有多少爱可以重来》百万豪装录音棚大声听",
  "answer": {
   "song": "有多少爱可以重来",
   "credit": "迪克牛仔",
   "first": "1999",
   "check": "right"
  }
 },
 {
  "set": "fresh",
  "title": "许飞《明年依然好时节》百万豪装录音棚大声听",
  "answer": {
   "silent": "silent"
  }
 },
 {
  "set": "fresh",
  "title": "任然&小来《雀跃》百万豪装录音棚大声听",
  "answer": {
   "silent": "silent"
  }
 },
 {
  "set": "fresh",
  "title": "周深《无尽冬》百万豪装录音棚大声听",
  "answer": {
   "silent": "silent"
  }
 },
 {
  "set": "fresh",
  "title": "蔡琴《你不要那样看着我的眼睛》百万豪装录音棚大声听",
  "answer": {
   "silent": "silent"
  }
 },
 {
  "set": "fresh",
  "title": "胡鸿钧《到此一游（《降魔的》主题曲）》百万豪装录音棚大声听",
  "answer": {
   "song": "到此一遊",
   "credit": "胡鴻鈞",
   "first": "2017",
   "check": "right"
  }
 },
 {
  "set": "fresh",
  "title": "关大洲《文忠印（《国家宝藏》第三季）》百万豪装录音棚大声听",
  "answer": {
   "song": "文忠印",
   "credit": "关大洲",
   "first": "2023",
   "check": "right"
  }
 },
 {
  "set": "fresh",
  "title": "吴琳珂Moske《钻石》百万豪装录音棚大声听",
  "answer": {
   "silent": "silent"
  }
 },
 {
  "set": "fresh",
  "title": "叶丽仪《上海滩》百万豪装录音棚大声听",
  "answer": {
   "song": "上海灘",
   "credit": "葉麗儀",
   "first": "2014",
   "check": "right song; DATE/VERSION DOUBTFUL (the song is from 1980; MusicBrainz's earliest official studio release for this recording is 2014)"
  }
 },
 {
  "set": "fresh",
  "title": "王菲《季候风》百万豪装录音棚大声听",
  "answer": {
   "song": "季候風",
   "credit": "王菲",
   "first": "2003-08",
   "check": "right song; DATE DOUBTFUL (album 天空 is 1994; the 1993 recording is credited to 王靖雯, her earlier name, which the artist check cannot see)"
  }
 },
 {
  "set": "fresh",
  "title": "李宗盛《新写的旧歌》百万豪装录音棚大声听",
  "answer": {
   "song": "新寫的舊歌",
   "credit": "李宗盛",
   "first": "2018",
   "check": "right"
  }
 },
 {
  "set": "fresh",
  "title": "梁静茹《崇拜》百万豪装录音棚大声听",
  "answer": {
   "song": "崇拜",
   "credit": "梁靜茹",
   "first": "2007",
   "check": "right"
  }
 },
 {
  "set": "fresh",
  "title": "国风新语&浮生梦&汐音社《探窗》百万豪装录音棚大声听",
  "answer": {
   "song": "探窗",
   "credit": "浮生梦 & 汐音社",
   "first": "2021",
   "check": "right"
  }
 },
 {
  "set": "fresh",
  "title": "汪苏泷&五月天阿信《笨蛋》百万豪装录音棚大声听",
  "answer": {
   "silent": "silent"
  }
 },
 {
  "set": "fresh",
  "title": "徐良&阿悄《天真》百万豪装录音棚大声听",
  "answer": {
   "silent": "no studio recording"
  }
 },
 {
  "set": "fresh",
  "title": "A-Lin《我还是不懂》百万豪装录音棚大声听",
  "answer": {
   "song": "我還是不懂",
   "credit": "A-Lin",
   "first": "2006",
   "check": "right"
  }
 },
 {
  "set": "fresh",
  "title": "小峰理纱《Resuscitated Hope（《GOSICK》片尾曲）》百万豪装录音棚大声听",
  "answer": {
   "silent": "silent"
  }
 },
 {
  "set": "fresh",
  "title": "周深《要一起（电视剧《锦心似玉》主题曲）》百万豪装录音棚大声听",
  "answer": {
   "song": "要一起 (电视剧《锦心似玉》主题曲)",
   "credit": "周深",
   "first": "2021",
   "check": "right"
  }
 },
 {
  "set": "fresh",
  "title": "G.E.M.邓紫棋《自由的你》百万豪装录音棚大声听",
  "answer": {
   "song": "自由的你",
   "credit": "G.E.M.",
   "first": "2026",
   "check": "right"
  }
 },
 {
  "set": "fresh",
  "title": "郑伊健《心照》百万豪装录音棚大声听",
  "answer": {
   "song": "心照",
   "credit": "鄭伊健",
   "first": "2004",
   "check": "right"
  }
 },
 {
  "set": "fresh",
  "title": "胡鸿钧《天地不容》百万豪装录音棚大声听",
  "answer": {
   "song": "天地不容",
   "credit": "胡鴻鈞",
   "first": "2016",
   "check": "right"
  }
 },
 {
  "set": "fresh",
  "title": "太妍《Letter To Myself》百万豪装录音棚大声听",
  "answer": {
   "silent": "silent"
  }
 },
 {
  "set": "fresh",
  "title": "李健《风吹麦浪》百万豪装录音棚大声听",
  "answer": {
   "song": "风吹麦浪",
   "credit": "李健",
   "first": "2007",
   "check": "right"
  }
 },
 {
  "set": "fresh",
  "title": "BOBO《光荣》百万豪装录音棚大声听",
  "answer": {
   "silent": "no studio recording"
  }
 },
 {
  "set": "fresh",
  "title": "梁静茹《燕尾蝶》百万豪装录音棚大声听",
  "answer": {
   "song": "燕尾蝶",
   "credit": "梁靜茹",
   "first": "2004",
   "check": "right"
  }
 },
 {
  "set": "fresh",
  "title": "潘德林&莫文迪&小金jojo《无悔当下》百万豪装录音棚大声听",
  "answer": {
   "silent": "silent"
  }
 },
 {
  "set": "fresh",
  "title": "张靓颖&毛不易《是的我们跳着舞》百万豪装录音棚大声听",
  "answer": {
   "song": "是的我们跳着舞",
   "credit": "张靓颖 & 毛不易",
   "first": "2026",
   "check": "right"
  }
 },
 {
  "set": "fresh",
  "title": "方大同&葛仲珊《爱不来》百万豪装录音棚大声听",
  "answer": {
   "song": "愛不來",
   "credit": "方大同 feat. Miss Ko葛仲珊",
   "first": "2014",
   "check": "right"
  }
 },
 {
  "set": "fresh",
  "title": "张敬轩《塞勒斯的爱》百万豪装录音棚大声听",
  "answer": {
   "silent": "silent"
  }
 },
 {
  "set": "fresh",
  "title": "徐良&孙羽幽《虐心》百万豪装录音棚大声听",
  "answer": {
   "song": "虐心",
   "credit": "徐良 & 孙羽幽",
   "first": "2013",
   "check": "right"
  }
 },
 {
  "set": "fresh",
  "title": "刘欢《千万次的问（《北京人在纽约》片头曲）》百万豪装录音棚大声听",
  "answer": {
   "silent": "versions months apart"
  }
 },
 {
  "set": "fresh",
  "title": "林俊杰《背对背拥抱》百万豪装录音棚大声听",
  "answer": {
   "song": "背對背擁抱",
   "credit": "林俊傑",
   "first": "2009",
   "check": "right"
  }
 },
 {
  "set": "fresh",
  "title": "【祝愿祖国繁荣昌盛🇨🇳】华语群星《我和我的祖国（电影《我和我的祖国》片尾曲）》百万豪装录音棚大声听",
  "answer": {
   "silent": "silent"
  }
 },
 {
  "set": "fresh",
  "title": "林子祥《敢爱敢做》百万豪装录音棚大声听",
  "answer": {
   "song": "敢愛敢做",
   "credit": "林子祥",
   "first": "1987",
   "check": "right"
  }
 },
 {
  "set": "fresh",
  "title": "【山河无恙 致敬英雄！】魏大勋《山河回声（烈士纪念日主题曲）》百万豪装录音棚大声听",
  "answer": {
   "silent": "silent"
  }
 },
 {
  "set": "fresh",
  "title": "李佳薇《失忆》百万豪装录音棚大声听",
  "answer": {
   "silent": "silent"
  }
 },
 {
  "set": "fresh",
  "title": "刘欢《弯弯的月亮》百万豪装录音棚大声听",
  "answer": {
   "song": "弯弯的月亮",
   "credit": "刘欢",
   "first": "1992",
   "check": "right"
  }
 },
 {
  "set": "fresh",
  "title": "冰幽&解忧草《辞·九门回忆》百万豪装录音棚大声听",
  "answer": {
   "silent": "silent"
  }
 },
 {
  "set": "fresh",
  "title": "黄龄《月半》百万豪装录音棚大声听",
  "answer": {
   "silent": "silent"
  }
 },
 {
  "set": "run2",
  "title": "李宇春《蜀绣》百万豪装录音棚大声听",
  "answer": {
   "silent": "no studio recording"
  }
 },
 {
  "set": "run2",
  "title": "周深《大梦归（《兰香如故》主题曲）》百万豪装录音棚大声听",
  "answer": {
   "song": "大梦归（电视剧《兰香如故》主题曲）",
   "credit": "周深",
   "first": "2026-09-11",
   "check": "right"
  }
 },
 {
  "set": "run2",
  "title": "许茹芸《如果云知道》百万豪装录音棚大声听",
  "answer": {
   "song": "如果雲知道",
   "credit": "許茹芸",
   "first": "1996-10-03",
   "check": "right"
  }
 },
 {
  "set": "run2",
  "title": "孙燕姿《不是真的爱我》百万豪装录音棚大声听",
  "answer": {
   "song": "不是真的愛我",
   "credit": "孫燕姿",
   "first": "2001",
   "check": "right"
  }
 },
 {
  "set": "run2",
  "title": "许嵩《白马非马》百万豪装录音棚大声听",
  "answer": {
   "song": "白马非马",
   "credit": "许嵩",
   "first": "2009-01-02",
   "check": "right"
  }
 },
 {
  "set": "run2",
  "title": "泽国同学《八千里路明月照》百万豪装录音棚大声听",
  "answer": {
   "silent": "no candidate"
  }
 },
 {
  "set": "run2",
  "title": "郁可唯《茶汤》百万豪装录音棚大声听",
  "answer": {
   "song": "茶汤",
   "credit": "郁可唯",
   "first": "2011-10-28",
   "check": "right"
  }
 },
 {
  "set": "run2",
  "title": "徐良《悲伤的李白》百万豪装录音棚大声听",
  "answer": {
   "song": "悲伤的李白",
   "credit": "徐良",
   "first": "2012-09-01",
   "check": "right"
  }
 },
 {
  "set": "run2",
  "title": "孙楠《千秋》百万豪装录音棚大声听",
  "answer": {
   "silent": "no candidate"
  }
 },
 {
  "set": "run2",
  "title": "云视听《shape of you》｜万元音箱的声音能塞进TWS里吗？｜丹拿同源调音·专业听音室零变量对比",
  "answer": {
   "silent": "no candidate"
  }
 },
 {
  "set": "run2",
  "title": "林俊杰《光阴副本》百万豪装录音棚大声听",
  "answer": {
   "song": "光阴副本",
   "credit": "林俊傑",
   "first": "(no date) ",
   "check": "right; no date (no date line possible)"
  }
 },
 {
  "set": "run2",
  "title": "久石让《Summer（菊次郎的夏天）》百万豪装录音棚大声听",
  "answer": {
   "silent": "no candidate"
  }
 },
 {
  "set": "run2",
  "title": "许嵩《我想牵着你的手》百万豪装录音棚大声听",
  "answer": {
   "song": "我想牵着你的手",
   "credit": "许嵩",
   "first": "2010-01-01",
   "check": "right"
  }
 },
 {
  "set": "run2",
  "title": "郑中基《闭目入神》百万豪装录音棚大声听",
  "answer": {
   "silent": "versions months apart"
  }
 },
 {
  "set": "run2",
  "title": "王北车《陷阱》百万豪装录音棚大声听",
  "answer": {
   "silent": "no studio recording"
  }
 },
 {
  "set": "run2",
  "title": "许茹芸《泪海》百万豪装录音棚大声听",
  "answer": {
   "song": "淚海",
   "credit": "許茹芸",
   "first": "1996-04",
   "check": "right"
  }
 },
 {
  "set": "run2",
  "title": "赵传《爱要怎么说出口》百万豪装录音棚大声听",
  "answer": {
   "song": "爱要怎么说出口",
   "credit": "趙傳",
   "first": "1993",
   "check": "right"
  }
 },
 {
  "set": "run2",
  "title": "朴孝信《눈의 꽃（《雪之花》）》百万豪装录音棚大声听",
  "answer": {
   "silent": "no candidate"
  }
 },
 {
  "set": "run2",
  "title": "金莎《你的嘴》百万豪装录音棚大声听",
  "answer": {
   "song": "你的嘴",
   "credit": "金莎",
   "first": "2010-10-15",
   "check": "right"
  }
 },
 {
  "set": "run2",
  "title": "林子祥《男儿当自强》百万豪装录音棚大声听",
  "answer": {
   "song": "男兒當自強",
   "credit": "林子祥",
   "first": "1991",
   "check": "right"
  }
 },
 {
  "set": "run2",
  "title": "林俊杰《豆浆油条》百万豪装录音棚大声听",
  "answer": {
   "song": "豆漿油條",
   "credit": "林俊傑",
   "first": "2004-06-04",
   "check": "right"
  }
 },
 {
  "set": "run2",
  "title": "Martynas Levickis&David Garrett《Por Una Cabeza（一步之遥）》百万豪装录音棚大声听",
  "answer": {
   "silent": "no candidate"
  }
 },
 {
  "set": "run2",
  "title": "梁静茹《爱久见人心》百万豪装录音棚大声听",
  "answer": {
   "song": "愛久見人心",
   "credit": "梁靜茹",
   "first": "2012-08-10",
   "check": "right"
  }
 },
 {
  "set": "run2",
  "title": "汪苏泷&林希儿《专属味道》百万豪装录音棚大声听",
  "answer": {
   "silent": "no studio recording"
  }
 },
 {
  "set": "run2",
  "title": "罗大佑《恋曲1990》百万豪装录音棚大声听",
  "answer": {
   "song": "戀曲1990",
   "credit": "羅大佑",
   "first": "1988-12-09",
   "check": "right"
  }
 },
 {
  "set": "run2",
  "title": "阿YueYue《我恨明月不照我》百万豪装录音棚大声听",
  "answer": {
   "silent": "no candidate"
  }
 },
 {
  "set": "run2",
  "title": "邓丽君《我只在乎你》百万豪装录音棚大声听",
  "answer": {
   "silent": "different artists"
  }
 },
 {
  "set": "run2",
  "title": "孟庭苇《风中有朵雨做的云》百万豪装录音棚大声听",
  "answer": {
   "song": "風中有朵雨做的雲",
   "credit": "孟庭葦",
   "first": "2005",
   "check": "right song; DATE DOUBTFUL (the song is from the early 1990s; 2005 is likely a reissue)"
  }
 },
 {
  "set": "run2",
  "title": "薛之谦《你还要我怎样》百万豪装录音棚大声听",
  "answer": {
   "song": "你还要我怎样",
   "credit": "薛之谦",
   "first": "2013-10-12",
   "check": "right"
  }
 },
 {
  "set": "run2",
  "title": "陶喆《今天没回家》百万豪装录音棚大声听",
  "answer": {
   "silent": "no studio recording"
  }
 },
 {
  "set": "run2",
  "title": "邓丽欣《电灯胆》百万豪装录音棚大声听",
  "answer": {
   "song": "電燈膽",
   "credit": "鄧麗欣",
   "first": "2007",
   "check": "right"
  }
 },
 {
  "set": "run2",
  "title": "徐誉滕《等一分钟》百万豪装录音棚大声听",
  "answer": {
   "song": "等一分钟",
   "credit": "徐誉滕",
   "first": "2008-10-22",
   "check": "right"
  }
 },
 {
  "set": "run2",
  "title": "单依纯《纯妹妹》百万豪装录音棚大声听",
  "answer": {
   "song": "纯妹妹",
   "credit": "单依纯",
   "first": "2024-07-19",
   "check": "right"
  }
 },
 {
  "set": "run2",
  "title": "棱镜乐队《这是我一生中最勇敢的瞬间》百万豪装录音棚大声听",
  "answer": {
   "silent": "no candidate"
  }
 },
 {
  "set": "run2",
  "title": "薛之谦《病态》百万豪装录音棚大声听",
  "answer": {
   "song": "病态",
   "credit": "薛之谦",
   "first": "2019-12-27",
   "check": "right"
  }
 },
 {
  "set": "run2",
  "title": "陈奕迅《斯德哥尔摩情人》百万豪装录音棚大声听",
  "answer": {
   "song": "斯德哥爾摩情人",
   "credit": "陳奕迅",
   "first": "2013-07-22",
   "check": "right"
  }
 },
 {
  "set": "run2",
  "title": "林俊杰《冻结》百万豪装录音棚大声听",
  "answer": {
   "song": "凍結",
   "credit": "林俊傑",
   "first": "2003-04-01",
   "check": "right"
  }
 },
 {
  "set": "run2",
  "title": "汪苏泷《因为了解》百万豪装录音棚大声听",
  "answer": {
   "silent": "no studio recording"
  }
 },
 {
  "set": "run2",
  "title": "Patty-Cake《Tough Love》百万豪装录音棚大声听",
  "answer": {
   "song": "Tough Love",
   "credit": "PattyCake",
   "first": "2020-03-31",
   "check": "ARTIST NOT PROVABLE (the credit \"PattyCake\" may be a different act from the video's \"Patty-Cake\"; it cannot be told without listening)"
  }
 },
 {
  "set": "run2",
  "title": "T-ara《Cry Cry》百万豪装录音棚大声听",
  "answer": {
   "silent": "no studio recording"
  }
 },
 {
  "set": "run2",
  "title": "黄品源《你怎么舍得我难过》百万豪装录音棚大声听",
  "answer": {
   "song": "你怎麼捨得我難過",
   "credit": "黃品源",
   "first": "(no date)",
   "check": "right song; VERSION NOT PROVABLE (a \"famous songs\" series release with no date; the original is on his early-1990s album)"
  }
 },
 {
  "set": "run2",
  "title": "杨坤 《空城》百万豪装录音棚大声听",
  "answer": {
   "song": "空城",
   "credit": "杨坤",
   "first": "2009-06-23",
   "check": "right"
  }
 },
 {
  "set": "v7",
  "title": "百万级装备听《Heat Waves》- Glass Animals【Hi-Res】",
  "answer": { "song": "Heat Waves", "credit": "Glass Animals", "first": "2020-06-29", "recording_id": "9f61e4a7" }
 },
 {
  "set": "v7",
  "title": "百万级装备听《Yellow》- Coldplay【Hi-Res】",
  "answer": { "song": "Yellow", "credit": "Coldplay", "first": "2000-06-26", "recording_id": "729cf505" }
 },
 {
  "set": "v7",
  "title": "百万级装备听《Sunflower》- Post Malone，Swae Lee【Hi-Res】",
  "answer": { "song": "Sunflower", "credit": "Post Malone & Swae Lee", "first": "2018-10-18", "recording_id": "b6df9d04" }
 },
 {
  "set": "v7",
  "title": "用百万级豪华装备试听The Weeknd《Blinding Lights》【Hi-Res】",
  "answer": { "song": "Blinding Lights", "credit": "The Weeknd", "first": "2019-11-29", "recording_id": "1a67e215" }
 },
 {
  "set": "v7",
  "title": "百万级装备听《星际穿越》原声 Cornfield Chase - Hans Zimmer【Hi-Res】",
  "answer": { "silent": "the 《》 holds a film, not a song" }
 },
 {
  "set": "v7",
  "title": "百万级装备听《繁花》电视剧插曲 偷心 - 张学友【Hi-Res】",
  "answer": { "silent": "the 《》 holds a television show, not a song" }
 },
 {
  "set": "v7",
  "title": "百万级装备听 周杰伦《叶惠美》整张专辑【Hi-Res】",
  "answer": { "silent": "the 《》 holds an album, not a song" }
 }
];
