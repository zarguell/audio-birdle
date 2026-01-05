export const sampleBirds = {
  us: [
    {
      id: 'amerob',
      name: 'American Robin',
      scientificName: 'Turdus migratorius',
      order: 'Passeriformes',
      family: 'Turdidae (Turdidae)',
      audioUrl: [
        {
          url: 'https://example.com/robin1.mp3',
          attribution: { recordist: 'John Doe', location: 'New York, NY', date: '2024-03-15' }
        },
        {
          url: 'https://example.com/robin2.mp3',
          attribution: { recordist: 'Jane Smith', location: 'Boston, MA', date: '2024-02-20' }
        }
      ],
      images: [
        {
          url: 'https://example.com/images/robin1.jpg',
          attribution: { photographer: 'Photo One', source: 'Macaulay Library', license: 'CC BY-NC 4.0' }
        }
      ],
      facts: 'The American Robin is a migratory songbird known for its orange-red breast and cheerful morning song.',
      learnMoreUrl: 'https://birdsoftheworld.org/species/american-robin'
    },
    {
      id: 'barswa',
      name: 'Barn Swallow',
      scientificName: 'Hirundo rustica',
      order: 'Passeriformes',
      family: 'Hirundinidae (Hirundinidae)',
      audioUrl: [
        { url: 'https://example.com/swallow1.mp3', attribution: {} }
      ],
      images: [],
      facts: '',
      learnMoreUrl: ''
    },
    {
      id: 'reccro',
      name: 'Red-crowned Crane',
      scientificName: 'Grus japonensis',
      order: 'Gruiformes',
      family: 'Gruidae (Gruidae)',
      audioUrl: [
        { url: 'https://example.com/crane1.mp3', attribution: {} }
      ],
      images: [],
      facts: '',
      learnMoreUrl: ''
    }
  ]
}

export const sampleRegions = [
  { id: 'us', name: 'United States' },
  { id: 'eu', name: 'Europe' }
]

export const sampleDailyData = [
  {
    date: '2025-12-27',
    region: 'us',
    answerHash: 'a1b2c3d4'
  }
]
