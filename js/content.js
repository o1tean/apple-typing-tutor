/** Public-domain practice text; sources and licensing: docs/content-sources.md. */

export const WORDS =
    `the of and a is in he to have it be for i they with not that on she as at by this we you do from or an but which would say all one will there who make when if man can what no go time up into year other out could some new know these take see get come only two any state give now may than then also find way day first even use more many must
think such like should so through people those over where just seem life good each become back world here between both thing hand own very tell how down work because school same under never house after great old still leave well want three another call against last number show most child feel part ask place few about might turn long while small problem during word live system area write again follow begin mister fact without program eye country himself city
stand provide much group hold too case off line night course put point government something head american let away always church bring high war since every unite room class keep before need however try though little woman end boy hear upon company service large side order run car week why water social move president business figure start face several mean set toward appear question among value young nothing family within serve member once form law matter often help continue john
name four power general per believe possible body development foot force increase pay important type meet nation play cost today expect kind door street home big reach girl require result month hour lead period office later white reason field sit example job action consider develop college rate around history national pass next experience position moment god mind public best study happen sense local interest walk perhaps method idea grow town money until read book policy effort person add ever remain
themselves although talk five speak probably almost effect society whole condition second across level center student light art shall send determine wife material least yet voice community party ago air carry wait mother tax build board lose already involve doctor human fall available thus learn draw anything process minute understand table special federal section death difference break remember century control far economic open ground stop stage full certain department whether change father better different piece indicate picture really quite receive
music itself road university information behind enough situation common purpose include free letter produce paper apply true together mile arm report cut land early evidence usually issue present real age plan peace bear necessary strong drive step record less horse spend friend right enter six wall short watch officer son statement morning unit heart modern therefore space greater fire along court above story alone personal suggest river able nor secretary operation allow sometimes organization major clear everything sure half plant
reduce county describe wear subject cent seek datum decide source food else nature committee accept stay event district volume opportunity station close equipment basic including explain third trial rise die offer except research note defense cover contain private black feeling south love cause raise represent suppose buy movement finally factor act amount product hope military club science prepare leader million difficult reaction test temperature complete decision drop fund market assume dead attention price quality game sort dark color lie simply
political fight building pressure husband realize establish medical recent obtain choose recognize window front growth permit image soon exist direction basis concern simple win character administration machine ten earth either term technique religious teacher principle production sale anyone evening association size actually disagree meeting kill instead range fill army labor hair floor cell rule international wish relation trouble thought writer performance population create congress lot pull stock especially yes leach language maintain foreign plane pattern agree dollar meaning element view
fine list religion beyond opinion design rather natural procedure central west occur tree certainly various individual low summer support near operate literature sound project southern answer normal patient late industrial return attitude knowledge catch poet role achieve length similar limit england fail hard hospital red throw relate addition western manner inch single throughout hundred hot prove join higher ready train distance spring hit bad function hotel police maybe former physical farm prevent charge detail moral directly treatment remove entire possibility
radio loss sign lay merely scene corner responsibility christian apparently measure likely indeed gun eat couple ride larger truth practice suddenly fear lady season cold pick chance express base institution hang theory worker mention beautiful agreement extend leg rest vary brown smile respect brother analysis future feed discussion total item influence freedom conference bill commission claim final strength shoot difficulty success region structure discuss effective mark hall dog glass relationship choice hill discover recently model date ship easy listen particular
enjoy ball technical governor announce nearly firm experiment pool serious aid longer visit strike square trip wonder director latter improve europe enemy according care mouth deal edge object account slowly demand sell afternoon suffer oil press wide contribute instance compare poem direct citizen herself audience election fix park bar immediately division english agency french boat faith top artist page saint facility finger manager gas series supply tooth weapon approach bed specific save marry none parent myself attend employee authority publish
settle marriage fiscal look interact democratic generally select kid captain importance march forget bank finish affair oh animal wednesday absence acceptable accessible accidentally accommodate accompanied accomplish accumulate accuracy achievement acknowledgment acquaintance acquire acquitted address admission adolescent advice advise advised affected affectionate aggravate aggressive alcohol allotted allusion amateur annual argument arrangement beginning capital capitol coming complement compliment definite desert dessert divide embarrass exaggerate existence explanation financially forehead forfeit forty forward fulfillment gauge grammar grammatically grief guaranteed guard guidance happened harass height
hero heroes humor hypocrisy hypocrite ignorant illogical imaginary imagine imitate immense incidentally incredible independent indispensable inevitable infinite influential initiative innocence intellectual intelligence intelligent interpret interrupt introduce irrelevant irresistible irritable irritated its laboratory legitimate leisure liable library license lightning lively loneliness lonely lying magazine maintenance maneuver manual manufacture mathematics meant medicine mere messenger miniature minutes mischievous missile mortgage muscles mysterious naturally nickel niece ninety ninth noticeable noticing nuclear nuisance obstacle occasionally occurred occurrence omission omitted opponent opposite optimism organize origin original
paid pamphlet parallel pastime peculiar permanent permissible physician planned pleasant poison possess possession possibly practically prairie precede preferred prejudiced preparation presence prevalent principal privilege proceed profession professor prominent pronunciation propaganda prophecy prophesy psychology publicly pumpkin pursue quantity quiet quizzes receipt receiving recommend reference referred referring regular relieve remembrance repetition representative reproduce restaurant rhythm ridiculous roommate sacrifice safety salary schedule seize separate sergeant severely sheriff shining sincerely skiing sophomore specimen speech sponsor strict stubbornness studying subtlety succeed successful succession sufficient suicide
summary superintendent supersede suppress surely surprise surround susceptible suspicious swimming symbol sympathize temperament tendency their thorough till tobacco tomorrow tournament traffic trafficked tragedy transferred tremendous tried tries truly twelfth tyranny unanimous unconscious undoubtedly unmistakably unnecessary usage useful useless using vacuum valuable varies vegetable vengeance venomous vice vigilance villain violence visible vitamins waive warrant warring weather weird wherever whichever wholly whose wield wintry withdrawal women worshiped wreck writing written yield`
    .split(/\s+/);

const QUOTE_SOURCE = 'https://www.gutenberg.org/files/27889/27889-h/27889-h.htm';
const AUTHORS = ["William Shakespeare", "Alexander Pope", "Francis Bacon", "Samuel Johnson",
    "Ralph Waldo Emerson", "William Wordsworth", "Henry Wadsworth Longfellow",
    "Samuel Taylor Coleridge", "Percy Bysshe Shelley", "John Keats", "Felicia Hemans",
    "Benjamin Franklin", "John Dryden", "Alfred Tennyson"];
const QUOTE_DATA = [
    ["365830039325", 0, 58, "I have had a dream, past the wit of man to say what dream it was."],
    ["5fbf6c408e39", 0, 42,
        "Knowing I lov'd my books, he furnish'd me From mine own library with volumes that I prize above my dukedom."
        ],
    ["a8031ab6f9ae", 0, 43,
        "Merrily, merrily shall I live now, Under the blossom that hangs on the bough."],
    ["809486a20acd", 0, 44, "How use doth breed a habit in a man!"],
    ["01f0e9d1a69c", 0, 47,
        "Our doubts are traitors, And make us lose the good we oft might win By fearing to attempt."
        ],
    ["f7408c5ae6be", 0, 49, "Virtue is bold, and goodness never fearful."],
    ["e675332318a0", 0, 49, "Truth is truth To the end of reckoning."],
    ["5ecb1c304b78", 0, 50, "Small cheer and great welcome makes a merry feast."],
    ["a4f2417a91a1", 0, 50, "Let 's go hand in hand, not one before another."],
    ["374fd869ddb5", 0, 51,
        "Silence is the perfectest herald of joy: I were but little happy, if I could say how much."
        ],
    ["b2e8cc54f966", 0, 54,
        "At Christmas I no more desire a rose Than wish a snow in May's new-fangled mirth; But like of each thing that in season grows."
        ],
    ["df2fe95bc113", 0, 55,
        "A merrier man, Within the limit of becoming mirth, I never spent an hour's talk withal."
        ],
    ["7a6529c635b8", 0, 56, "They have been at a great feast of languages, and stolen the scraps."],
    ["fb652516cf3d", 0, 56,
        "A jest's prosperity lies in the ear Of him that hears it, never in the tongue Of him that makes it."
        ],
    ["2cdbc8a6d09c", 0, 58,
        "I know a bank where the wild thyme blows, Where oxlips and the nodding violet grows, Quite over-canopied with luscious woodbine, With sweet musk-roses and with eglantine."
        ],
    ["b147b06cb172", 0, 59, "For never anything can be amiss, When simpleness and duty tender it."],
    ["43d7721ea264", 0, 102, "One touch of nature makes the whole world kin."],
    ["368c0f94e9fa", 0, 105,
        "What 's in a name? That which we call a rose By any other name would smell as sweet."],
    ["abdcd54f3db1", 0, 137,
        "Suit the action to the word, the word to the action; with this special observance, that you o'erstep not the modesty of nature."
        ],
    ["9efcf2d6d07e", 0, 158, "To business that we love we rise betime, And go to 't with delight."],
    ["1a1566057b75", 1, 316,
        "The spider's touch, how exquisitely fine! Feels at each thread, and lives along the line."
        ],
    ["0ddd1db7e057", 1, 316,
        "Remembrance and reflection how allied! What thin partitions sense from thought divide!"
        ],
    ["5b8f9c6cd5ee", 1, 315,
        "Together let us beat this ample field, Try what the open, what the covert yield."],
    ["36b50117c3fb", 1, 317,
        "On life's vast ocean diversely we sail, Reason the card, but passion is the gale."],
    ["51415d3f904d", 1, 318,
        "Learn of the little nautilus to sail, Spread the thin oar, and catch the driving gale."
        ],
    ["1a3889d1ffb1", 1, 319,
        "Honour and shame from no condition rise; Act well your part, there all the honour lies."
        ],
    ["eaeed066caf6", 1, 320, "Thou wert my guide, philosopher, and friend."],
    ["25b9e7a966c5", 1, 320,
        "To observations which ourselves we make, We grow more partial for th' observer's sake."
        ],
    ["47b634b9e9eb", 1, 323,
        "One science only will one genius fit: So vast is art, so narrow human wit."],
    ["f9d9b0f2c02f", 1, 323,
        "Whoever thinks a faultless piece to see, Thinks what ne'er was, nor is, nor e'er shall be."
        ],
    ["80541e5191a1", 1, 323,
        "True wit is Nature to advantage dress'd, What oft was thought, but ne'er so well express'd."
        ],
    ["d17344f20354", 1, 323,
        "Words are like leaves; and where they most abound, Much fruit of sense beneath is rarely found."
        ],
    ["04633f983b49", 1, 317,
        "Extremes in nature equal ends produce; In man they join to some mysterious use."],
    ["d86e4aa452be", 1, 325,
        "Men must be taught as if you taught them not, And things unknown propos'd as things forgot."
        ],
    ["090308029879", 2, 164,
        "No pleasure is comparable to the standing upon the vantage-ground of truth."],
    ["43057768a3f4", 2, 167,
        "Discretion of speech is more than eloquence; and to speak agreeably to him with whom we deal is more than to speak in good words or in good order."
        ],
    ["f06f7bd87770", 2, 167,
        "Men's thoughts are much according to their inclination, their discourse and speeches according to their learning and infused opinions."
        ],
    ["58fcc6ca8674", 2, 167, "Chiefly the mould of a man's fortune is in his own hands."],
    ["86e15b7dd34c", 2, 168,
        "Some books are to be tasted, others to be swallowed, and some few to be chewed and digested."
        ],
    ["aca2256d3c50", 2, 168,
        "Reading maketh a full man, conference a ready man, and writing an exact man."],
    ["a4a842f16338", 2, 168,
        "Histories make men wise; poets, witty; the mathematics, subtile; natural philosophy, deep; moral, grave; logic and rhetoric, able to contend."
        ],
    ["360d405e2409", 2, 168, "Books must follow sciences, and not sciences books."],
    ["42c2f785637a", 3, 368, "A man used to vicissitudes is not easily dejected."],
    ["64f4ede226c2", 3, 368, "Few things are impossible to diligence and skill."],
    ["b5453e343135", 3, 368, "Knowledge is more than equivalent to force."],
    ["128f69b3cc49", 3, 368, "Many things difficult to design prove easy to performance."],
    ["10e16318d20e", 3, 368, "Example is always more efficacious than precept."],
    ["8054f9931c04", 3, 369,
        "What is read twice is commonly better remembered than what is transcribed."],
    ["f65d93df6b80", 3, 372,
        "Knowledge is of two kinds: we know a subject ourselves, or we know where we can find information upon it."
        ],
    ["87d23accb0cb", 3, 373,
        "The true, strong, and sound mind is the mind that can embrace equally great things and small."
        ],
    ["1e8f212464f0", 4, 599, "If eyes were made for seeing, Then Beauty is its own excuse for being."],
    ["d42ef7ff4f0a", 4, 601, "Time dissipates to shining ether the solid angularity of facts."],
    ["71da4c852757", 4, 601, "Nature is a mutable cloud which is always and never the same."],
    ["52e90f3d15f1", 4, 601,
        "Everything in Nature contains all the powers of Nature. Everything is made of one hidden stuff."
        ],
    ["5bea5ecd293f", 4, 602, "A friend may well be reckoned the masterpiece of Nature."],
    ["690ffe7c8d6a", 4, 602, "Nothing great was ever achieved without enthusiasm."],
    ["fe32d2412e21", 4, 602,
        "Thought is the property of him who can entertain it, and of him who can adequately place it."
        ],
    ["3c69f579b170", 4, 603, "Life is not so short but that there is always time enough for courtesy."],
    ["ab8a774c2772", 4, 604,
        "In fact, it is as difficult to appropriate the thoughts of others as it is to invent."
        ],
    ["ed53c339fd9e", 5, 466,
        "O Reader! Had you in your mind Such stores as silent thought can bring, O gentle Reader! you would find A tale in everything."
        ],
    ["305c9c240a6f", 5, 466, "And 't is my faith, that every flower Enjoys the air it breathes."],
    ["23d326fdac14", 5, 466, "Come forth into the light of things, Let Nature be your teacher."],
    ["543bda87ab60", 5, 466,
        "One impulse from a vernal wood May teach you more of man, Of moral evil and of good, Than all the sages can."
        ],
    ["ee9ba979d746", 5, 485,
        "Soft is the music that would charm forever; The flower of sweetest smell is shy and lowly."
        ],
    ["6d9a7ea72c17", 5, 471, "He murmurs near the running brooks A music sweeter than their own."],
    ["65d2891575df", 5, 473, "The music in my heart I bore Long after it was heard no more."],
    ["83cfe3267bea", 5, 477, "Sweetest melodies Are those that are by distance made more sweet."],
    ["30d77dadcfc6", 5, 477, "The rainbow comes and goes, And lovely is the rose."],
    ["d6f6655e384b", 5, 479, "Wisdom is ofttimes nearer when we stoop Than when we soar."],
    ["f81e33f5871a", 6, 612, "Look, then, into thine heart, and write!"],
    ["8511296f43d4", 6, 612,
        "Let us, then, be up and doing, With a heart for any fate; Still achieving, still pursuing, Learn to labour and to wait."
        ],
    ["5cf4aff3fc1f", 6, 613, "The hooded clouds, like friars, Tell their beads in drops of rain."],
    ["0f1b8833d716", 6, 616,
        "The heights by great men reached and kept Were not attained by sudden flight, But they while their companions slept Were toiling upward in the night."
        ],
    ["1fb37b16a347", 6, 613, "No tears Dim the sweet look that Nature wears."],
    ["8ec652ff8e7b", 7, 498, "Without a breeze, without a tide, She steadies with upright keel."],
    ["d9a6a711ae73", 7, 498,
        "The moving moon went up the sky, And nowhere did abide; Softly she was going up, And a star or two beside."
        ],
    ["ccc73f66c2c0", 7, 499, "Oh sleep! it is a gentle thing, Beloved from pole to pole."],
    ["c369e235a6f6", 7, 500,
        "A damsel with a dulcimer In a vision once I saw: It was an Abyssinian maid, And on her dulcimer she played, Singing of Mount Abora."
        ],
    ["90aa309661f9", 7, 502, "My eyes make pictures when they are shut."],
    ["2036849c655c", 8, 567,
        "Music, when soft voices die, Vibrates in the memory; Odours, when sweet violets sicken, Live within the sense they quicken."
        ],
    ["2cace8bf92d2", 8, 565,
        "Life, like a dome of many-coloured glass, Stains the white radiance of eternity."],
    ["b65fb4144350", 8, 567, "I love tranquil solitude And such society As is quiet, wise, and good."],
    ["e147d44979dd", 8, 567,
        "Sing again, with your dear voice revealing A tone Of some world far from ours, Where music and moonlight and feeling Are one."
        ],
    ["5cd57b6a22f4", 9, 574,
        "A thing of beauty is a joy forever; Its loveliness increases; it will never Pass into nothingness."
        ],
    ["42e47eb32bfc", 9, 575, "Sudden a thought came like a full-blown rose, Flushing his brow."],
    ["ad14d0cd12d3", 9, 575,
        "Those green-robed senators of mighty woods, Tall oaks, branch-charmed by the earnest stars, Dream, and so dream all night without a stir."
        ],
    ["183cdf18401e", 9, 575,
        "He play'd an ancient ditty long since mute, In Provence call'd \"La belle dame sans mercy.\""
        ],
    ["764c1e1d39ce", 10, 569,
        "The breaking waves dashed high On a stern and rock-bound coast, And the woods against a stormy sky Their giant branches tossed."
        ],
    ["f7017b0dd0a8", 10, 570,
        "Come to the sunset tree! The day is past and gone; The woodman's axe lies free, And the reaper's work is done."
        ],
    ["c0019113ae72", 10, 571,
        "I have looked on the hills of the stormy North, And the larch has hung his tassels forth."
        ],
    ["909e87206886", 11, 360,
        "Dost thou love life? Then do not squander time, for that is the stuff life is made of."
        ],
    ["7c57d43a7cc3", 11, 360, "Never leave that till to-morrow which you can do to-day."],
    ["bebdb2ee5c21", 11, 360,
        "Vessels large may venture more, But little boats should keep near shore."],
    ["0fbd8bacf3de", 11, 360, "Experience keeps a dear school, but fools will learn in no other."],
    ["59b187107a5c", 12, 270, "Wit will shine Through the harsh cadence of a rugged line."],
    ["18e88d4abe32", 12, 277,
        "I have a soul that like an ample shield Can take in all, and verge enough for more."],
    ["2e32bc6a2804", 12, 275,
        "Errors, like straws, upon the surface flow; He who would search for pearls must dive below."
        ],
    ["bdb9d7e8a4b9", 13, 623,
        "Because right is right, to follow right Were wisdom in the scorn of consequence."],
    ["0e90f4e1ac50", 13, 625, "I am a part of all that I have met."],
    ["e6ec8f9f4505", 13, 626, "Knowledge comes, but wisdom lingers."]
];

export const QUOTES = QUOTE_DATA.map(([hash, author, page, text]) => ({
    id: `bartlett-${hash}`,
    author: AUTHORS[author],
    text,
    source: `${QUOTE_SOURCE}#Pg_${page}`
}));
