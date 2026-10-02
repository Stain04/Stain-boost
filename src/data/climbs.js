// The climb pages (/boost/<slug> and /ar/boost/<slug>): one page per popular rank climb.
// Prices are never written here — the pages compute them from src/data/pricing.js.
// Copy rule: honest and general. No promised times, win rates or rewards we can't check.

/** from/to = [tier index, division index] in RB_TIERS / RB_DIVS (Masters has no division). */
export const CLIMBS = [
  {
    slug: 'iron-to-bronze', from: [0, 0], to: [1, 0], guide: 'how-to-escape-iron',
    en: {
      intro: "Iron is the lowest rank in League, and games there are decided by whoever gives away less free gold. An Iron to Bronze boost gets you out of the bottom tier for good, played by a Challenger player who doesn't make Iron mistakes.",
      why: 'Most Iron players are stuck because of habits — too many deaths, missed farm, chasing kills — not because of their teammates. Bronze plays the same way with fewer of those mistakes, so the habits that get you out of Iron also carry you through Bronze.',
      tips: ['Die less than anyone else in your game; it matters more than any outplay.', 'Aim for 50+ CS at 10 minutes before you worry about anything fancier.', 'After every won fight, take a tower or a dragon instead of chasing.'],
    },
    ar: {
      intro: 'آيرون هو أدنى رانك في ليج أوف ليجندز، والمباريات فيه تُحسم لصالح الفريق الذي يمنح ذهبًا مجانيًا أقل. بوست من آيرون إلى برونز يُخرجك من أدنى رانك نهائيًا، ويلعبه لاعب تشالنجر لا يرتكب أخطاء الآيرون.',
      why: 'معظم لاعبي الآيرون عالقون بسبب عادات خاطئة — كثرة الموت، وإهمال الفارم، وملاحقة القتلات — وليس بسبب زملائهم. البرونز يُلعب بالطريقة نفسها مع أخطاء أقل، لذلك العادات التي تُخرجك من الآيرون تحملك عبر البرونز أيضًا.',
      tips: ['مُت أقل من أي لاعب آخر في المباراة؛ هذا أهم من أي حركة استعراضية.', 'استهدف 50 فارم أو أكثر عند الدقيقة العاشرة قبل أي شيء آخر.', 'بعد كل قتال تربحه، خذ برجًا أو تنينًا بدل ملاحقة الخصوم.'],
    },
  },
  {
    slug: 'bronze-to-silver', from: [1, 0], to: [2, 0], guide: 'how-to-escape-bronze',
    en: {
      intro: 'Bronze is where many players spend the longest: games feel chaotic and leads get thrown in both directions. A Bronze to Silver boost skips that grind.',
      why: 'Silver players punish mistakes a little more often, and teams start grouping for dragons and towers. The jump is mostly about consistency — fewer deaths, better recall timing and playing for objectives.',
      tips: ['Play two champions in one role until you are out of Bronze.', 'Push your wave into the enemy tower before every recall.', 'Mute chat and ping instead; arguments cost games.'],
    },
    ar: {
      intro: 'البرونز هو الرانك الذي يقضي فيه كثير من اللاعبين أطول وقت: المباريات فوضوية والتفوق يضيع في الاتجاهين. بوست من برونز إلى سيلفر يختصر عليك هذا التعب.',
      why: 'لاعبو السيلفر يعاقبون على الأخطاء أكثر قليلًا، والفرق تبدأ بالتجمع على التنانين والأبراج. الانتقال يعتمد أساسًا على الثبات: موت أقل، وتوقيت أفضل للعودة إلى القاعدة، واللعب على الأهداف.',
      tips: ['العب بطلين فقط في دور واحد حتى تخرج من البرونز.', 'ادفع الويف إلى برج الخصم قبل كل عودة إلى القاعدة.', 'اكتم الشات واستخدم الإشارات؛ الجدال يخسرك المباريات.'],
    },
  },
  {
    slug: 'silver-to-gold', from: [2, 0], to: [3, 0], guide: 'how-to-escape-silver',
    en: {
      intro: 'Silver to Gold is one of the most requested boosts in League: Gold is the rank many players set as their goal for the season. Stain gets you there on your own account, one division at a time.',
      why: 'In Gold, players start to understand wave management and objective timers, so the free kills that win Silver games dry up. Climbing means turning small leads into towers and dragons instead of chasing.',
      tips: ['Ward the river before every dragon spawns.', 'Back off when you do not know where the enemy jungler is.', 'Lock in a small champion pool and learn its power spikes.'],
    },
    ar: {
      intro: 'من سيلفر إلى جولد من أكثر أنواع البوست طلبًا في ليج: الجولد هو الرانك الذي يضعه كثير من اللاعبين هدفًا للموسم. Stain يوصلك إليه على حسابك، ديفيجن بعد ديفيجن.',
      why: 'في الجولد يبدأ اللاعبون بفهم إدارة الويف وتوقيتات الأهداف، فتقل القتلات المجانية التي تربح مباريات السيلفر. التقدم يعني تحويل التفوق الصغير إلى أبراج وتنانين بدل الملاحقة.',
      tips: ['ضع وارد في النهر قبل كل ظهور للتنين.', 'تراجع عندما لا تعرف مكان جانغل الخصم.', 'التزم بعدد قليل من الأبطال وتعلّم أوقات قوتهم.'],
    },
  },
  {
    slug: 'gold-to-platinum', from: [3, 0], to: [4, 0], guide: 'how-to-escape-gold',
    en: {
      intro: "Gold to Platinum is where the game starts to feel serious: opponents trade well in lane and junglers track each other. A Gold to Platinum boost takes you past one of the most crowded parts of the ladder.",
      why: 'Platinum games are decided by macro — side waves, vision around objectives and closing out leads. Players who win lane but lose the map can stay stuck in Gold for months.',
      tips: ['After laning, push side waves before every objective.', 'Stop fighting without vision in the enemy jungle.', 'When you are ahead, group and siege instead of splitting up.'],
    },
    ar: {
      intro: 'من جولد إلى بلاتينيوم تبدأ اللعبة بالجدية: الخصوم يتبادلون الضربات بذكاء في اللاين، والجانغلرز يتتبعون بعضهم. هذا البوست ينقلك عبر واحد من أكثر أجزاء الترتيب ازدحامًا.',
      why: 'مباريات البلاتينيوم تُحسم بالماكرو: الويفات الجانبية، والرؤية حول الأهداف، وإنهاء المباراة عند التفوق. اللاعبون الذين يربحون اللاين ويخسرون الخريطة قد يعلقون في الجولد لشهور.',
      tips: ['بعد مرحلة اللاين، ادفع الويفات الجانبية قبل كل هدف.', 'توقف عن القتال بدون رؤية داخل جانغل الخصم.', 'عندما تكون متقدمًا، تجمّع مع فريقك وحاصر الأبراج بدل التفرق.'],
    },
  },
  {
    slug: 'platinum-to-emerald', from: [4, 0], to: [5, 0], guide: 'how-to-reach-emerald',
    en: {
      intro: 'Emerald sits between Platinum and Diamond, and it is where the ladder gets tighter. A Platinum to Emerald boost is a common step for players aiming at Diamond.',
      why: 'Emerald players rarely give away free kills, so games swing on small decisions: recall timing, who has priority before dragon and who starts the first bad fight. Consistency matters more than mechanics here.',
      tips: ["Track the enemy jungler's first clear and play away from it.", 'Crash your wave before you recall so you do not lose farm.', 'Review one loss a day and find the single mistake you made.'],
    },
    ar: {
      intro: 'الإيميرالد يقع بين البلاتينيوم والدايموند، وهو المكان الذي يصبح فيه الترتيب أصعب. بوست من بلاتينيوم إلى إيميرالد خطوة شائعة للاعبين الذين يستهدفون الدايموند.',
      why: 'لاعبو الإيميرالد نادرًا ما يمنحون قتلات مجانية، لذلك تتحدد المباريات بقرارات صغيرة: توقيت العودة، ومن يملك الأفضلية قبل التنين، ومن يبدأ أول قتال خاسر. الثبات هنا أهم من المهارة الميكانيكية.',
      tips: ['تتبّع أول جولة لجانغل الخصم والعب بعيدًا عنها.', 'أوصل الويف إلى برج الخصم قبل العودة حتى لا تخسر الفارم.', 'راجع خسارة واحدة كل يوم وابحث عن الخطأ الذي ارتكبته أنت.'],
    },
  },
  {
    slug: 'emerald-to-diamond', from: [5, 0], to: [6, 0], guide: 'how-to-reach-diamond',
    en: {
      intro: 'Diamond is the rank most players remember reaching. An Emerald to Diamond boost covers the four divisions below it, played by a Challenger jungler.',
      why: 'High Emerald games are punishing: one caught side lane or a Baron without vision can decide the game. LP matters more here too — a few losses in a row can cost a division.',
      tips: ['Never start Baron without vision and the enemy shown somewhere else.', 'Stop after two losses in a row; tilt costs more LP here than anywhere.', 'Play champions that can carry from behind, not only from ahead.'],
    },
    ar: {
      intro: 'الدايموند هو الرانك الذي يتذكر معظم اللاعبين لحظة وصولهم إليه. بوست من إيميرالد إلى دايموند يغطي الديفيجنات الأربع التي تسبقه، ويلعبه جانغلر تشالنجر.',
      why: 'مباريات الإيميرالد العالي قاسية: لاعب واحد يُمسك في لاين جانبي أو بارون بدون رؤية قد يحسم المباراة. ونقاط LP أهم هنا أيضًا؛ بضع خسارات متتالية قد تكلفك ديفيجن كاملًا.',
      tips: ['لا تبدأ البارون بدون رؤية وبدون معرفة مكان الخصوم.', 'توقف بعد خسارتين متتاليتين؛ التيلت يكلفك LP هنا أكثر من أي مكان آخر.', 'العب أبطالًا تستطيع الحمل وأنت متأخر، لا عندما تكون متقدمًا فقط.'],
    },
  },
  {
    slug: 'diamond-to-master', from: [6, 0], to: [7, 0], guide: 'how-to-reach-master',
    en: {
      intro: 'Master is the first apex tier: no more divisions, just LP. A Diamond to Master boost is played by a Challenger player who knows these lobbies well.',
      why: 'Diamond I to Master is one of the hardest steps in the game: lobbies are full of players who have been Master before, and every game is close. Wins are worth less LP here, so consistency over many games is what gets you through.',
      tips: ['Queue only when you are fresh; one tired session can cost a whole division.', 'Play a very small pool and know every matchup for it.', 'Check the whole map at every recall, not only your lane.'],
    },
    ar: {
      intro: 'الماستر هو أول الرانكات العليا: لا ديفيجنات بعده، فقط نقاط LP. بوست من دايموند إلى ماستر يلعبه لاعب تشالنجر يعرف هذه المباريات جيدًا.',
      why: 'الانتقال من دايموند 1 إلى ماستر من أصعب الخطوات في اللعبة: المباريات مليئة بلاعبين وصلوا الماستر من قبل وكل مباراة متقاربة. الفوز يعطي LP أقل هنا، لذلك الثبات على عدد كبير من المباريات هو ما يوصلك.',
      tips: ['العب فقط عندما تكون مرتاحًا؛ جلسة واحدة متعبة قد تكلفك ديفيجن كاملًا.', 'العب عددًا قليلًا جدًا من الأبطال تعرف كل مواجهاتهم.', 'انظر إلى الخريطة كاملة عند كل عودة، لا إلى لاينك فقط.'],
    },
  },
  {
    slug: 'iron-to-gold', from: [0, 0], to: [3, 0], guide: 'how-to-climb-faster',
    en: {
      intro: 'Iron to Gold covers three full tiers in one order — the biggest jump most players ever make. Stain plays every game from Iron IV until you reach Gold IV.',
      why: 'Climbing from Iron to Gold on your own often takes months, because each tier needs a slightly better version of the same habits. One order with one booster means one consistent player the whole way, instead of a different person for each tier.',
      tips: ['Track your deaths and your CS at 10 minutes in every game.', 'Keep the same two champions for the whole climb.', 'Take a break after two losses so a bad day does not cost a tier.'],
    },
    ar: {
      intro: 'من آيرون إلى جولد يغطي ثلاث رتب كاملة في طلب واحد، وهي أكبر قفزة يقوم بها معظم اللاعبين. Stain يلعب كل مباراة من آيرون 4 حتى تصل إلى جولد 4.',
      why: 'الصعود من آيرون إلى جولد بنفسك يستغرق غالبًا شهورًا، لأن كل رتبة تحتاج نسخة أفضل قليلًا من العادات نفسها. طلب واحد مع لاعب واحد يعني أسلوبًا ثابتًا طوال الطريق، بدل شخص مختلف لكل رتبة.',
      tips: ['سجّل عدد مرات موتك والفارم عند الدقيقة العاشرة في كل مباراة.', 'حافظ على البطلين نفسيهما طوال الصعود.', 'خذ استراحة بعد خسارتين حتى لا يكلفك يوم سيئ رتبة كاملة.'],
    },
  },
  {
    slug: 'bronze-to-gold', from: [1, 0], to: [3, 0], guide: 'how-to-escape-bronze',
    en: {
      intro: 'Bronze to Gold skips Silver entirely: eight divisions from Bronze IV to Gold IV in one order. It is a common goal for players who want to finish a season in Gold.',
      why: 'Bronze and Silver reward the same thing — fewer mistakes than the other nine players. The difference is speed: a Challenger player turns small leads into objectives every game, so the climb does not stall at the Silver plateau.',
      tips: ['Lose fewer lanes before you try to win more of them.', 'Ward the river at three minutes to spot the first gank.', 'Stop playing ranked when you notice you are typing in chat.'],
    },
    ar: {
      intro: 'من برونز إلى جولد يتخطى السيلفر كاملًا: ثماني ديفيجنات من برونز 4 إلى جولد 4 في طلب واحد. وهو هدف شائع للاعبين الذين يريدون إنهاء الموسم في الجولد.',
      why: 'البرونز والسيلفر يكافئان الشيء نفسه: أخطاء أقل من بقية اللاعبين التسعة. الفرق في السرعة؛ لاعب تشالنجر يحوّل كل تفوق صغير إلى أهداف في كل مباراة، فلا يتوقف الصعود عند حاجز السيلفر.',
      tips: ['قلّل خسارة اللاين قبل أن تحاول الفوز بها أكثر.', 'ضع وارد في النهر عند الدقيقة الثالثة لترى أول جانك.', 'توقف عن الرانكد عندما تلاحظ أنك تكتب في الشات.'],
    },
  },
  {
    slug: 'silver-to-platinum', from: [2, 0], to: [4, 0], guide: 'how-to-escape-silver',
    en: {
      intro: 'Silver to Platinum is two full tiers — from one of the most crowded ranks on the ladder to the one where macro starts to matter. Stain plays the whole climb on your account or in duo with you.',
      why: 'Players who reach Gold on mechanics alone often stall there, because Platinum games are won on the map: rotations, vision and side waves. One booster for the whole climb keeps the play style consistent from Silver IV to Platinum IV.',
      tips: ['Learn to freeze your wave when you are ahead in lane.', 'Rotate to the side of the map where the next objective spawns.', 'Never face-check a bush late in the game.'],
    },
    ar: {
      intro: 'من سيلفر إلى بلاتينيوم رتبتان كاملتان: من واحد من أكثر الرانكات ازدحامًا إلى الرانك الذي يبدأ فيه الماكرو بالأهمية. Stain يلعب الصعود كاملًا على حسابك أو معك في الديو.',
      why: 'اللاعبون الذين يصلون الجولد بالمهارة الميكانيكية وحدها غالبًا ما يعلقون هناك، لأن مباريات البلاتينيوم تُكسب على الخريطة: التنقل، والرؤية، والويفات الجانبية. لاعب واحد للصعود كاملًا يعني أسلوب لعب ثابتًا من سيلفر 4 إلى بلاتينيوم 4.',
      tips: ['تعلّم تثبيت الويف (فريز) عندما تتفوق في اللاين.', 'تحرّك إلى جهة الخريطة التي سيظهر فيها الهدف التالي.', 'لا تدخل شجيرة بدون رؤية في آخر المباراة.'],
    },
  },
  {
    slug: 'gold-to-emerald', from: [3, 0], to: [5, 0], guide: 'how-to-escape-gold',
    en: {
      intro: 'Gold to Emerald covers Platinum and lands you one tier below Diamond. It is the boost for players who are tired of Gold and Platinum lobbies and want to play at a higher level.',
      why: 'Platinum is where many climbs slow down: games are longer, mistakes are punished, and LP gains drop after a losing streak. Stain keeps the games clean so the climb does not stall halfway.',
      tips: ['Push side waves before grouping for Baron or Elder.', 'Keep track of enemy Flash and ultimate cooldowns.', 'Stop after two losses; a losing streak costs more than a day off.'],
    },
    ar: {
      intro: 'من جولد إلى إيميرالد يغطي البلاتينيوم ويضعك على بُعد رتبة واحدة من الدايموند. هذا البوست للاعبين الذين ملّوا مباريات الجولد والبلاتينيوم ويريدون اللعب على مستوى أعلى.',
      why: 'البلاتينيوم هو المكان الذي يتباطأ فيه كثير من الصعود: المباريات أطول، والأخطاء تُعاقب، ونقاط LP تقل بعد سلسلة خسارات. Stain يلعب المباريات بثبات حتى لا يتوقف الصعود في منتصف الطريق.',
      tips: ['ادفع الويفات الجانبية قبل التجمع على البارون أو الإلدر.', 'تابع أوقات فلاش الخصوم وألتماتهم.', 'توقف بعد خسارتين؛ سلسلة الخسارات تكلفك أكثر من يوم راحة.'],
    },
  },
  {
    slug: 'platinum-to-diamond', from: [4, 0], to: [6, 0], guide: 'how-to-reach-diamond',
    en: {
      intro: 'Platinum to Diamond is the climb many players dream about: through Emerald and into Diamond in one order. It is played by a Challenger Master Yi main who knows these games well.',
      why: 'Emerald is a wall for many players because games are close and every throw is punished. Getting through needs a high win rate over many games, which is what a Challenger player brings to these lobbies.',
      tips: ['Track the enemy jungler on every objective timer.', 'Close out games — do not chase into fog of war when you are ahead.', 'Review your deaths: most are avoidable with one more ward.'],
    },
    ar: {
      intro: 'من بلاتينيوم إلى دايموند هو الصعود الذي يحلم به كثير من اللاعبين: عبر الإيميرالد وصولًا إلى الدايموند في طلب واحد. يلعبه لاعب تشالنجر متخصص في ماستر يي ويعرف هذه المباريات جيدًا.',
      why: 'الإيميرالد جدار أمام كثير من اللاعبين لأن المباريات متقاربة وكل خطأ يُعاقب. تجاوزه يحتاج نسبة فوز عالية على عدد كبير من المباريات، وهذا ما يقدمه لاعب تشالنجر في هذه المستويات.',
      tips: ['تتبّع جانغل الخصم عند كل توقيت هدف.', 'أنهِ المباريات؛ لا تلاحق الخصوم في الضباب عندما تكون متقدمًا.', 'راجع مرات موتك: معظمها كان يمكن تجنبه بوارد إضافي.'],
    },
  },
];

export const climbBySlug = (slug) => CLIMBS.find((c) => c.slug === slug);
