import type {
  AskResponse,
  LectureDetail,
  LectureListItem,
  LectureProgress,
  LectureStatus,
  QuizQuestion,
  UploadLectureResponse,
  LecternApiClient,
} from './types';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const INITIAL_LECTURES: LectureDetail[] = [
  {
    id: 'lec-1',
    title: 'Distributed Systems: Raft Consensus & State Machine Replication',
    status: 'done',
    durationSec: 1124, // ~18m 44s
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
    summary:
      'This lecture covers the fundamentals of consensus in fault-tolerant distributed systems. We discuss the limitations of two-phase commit and Paxos before diving deeply into the Raft consensus algorithm. Core topics include leader election via randomized timeouts, log replication mechanisms, split-brain prevention through majorities (quorum), and safety invariants guaranteeing consistency across network partitions.',
    keyTerms: [
      {
        term: 'State Machine Replication',
        definition:
          'A technique for building fault-tolerant services by running identical deterministic state machines across multiple replica nodes, fed by an agreed-upon sequence of inputs.',
      },
      {
        term: 'Raft Consensus',
        definition:
          'A consensus algorithm designed to be understandable, decomposing the problem into leader election, log replication, and safety.',
      },
      {
        term: 'Quorum',
        definition:
          'The minimum number of nodes that must agree on a proposal (typically floor(N/2) + 1) to guarantee that any two quorums overlap by at least one node.',
      },
      {
        term: 'Split Brain',
        definition:
          'A catastrophic condition in a distributed cluster where network partitions cause two distinct subsets of nodes to each believe they are the authoritative primary.',
      },
      {
        term: 'Randomized Election Timers',
        definition:
          'The mechanism in Raft where nodes choose random wait times between 150ms-300ms before triggering an election, preventing split-vote deadlocks.',
      },
    ],
    flashcards: [
      {
        question: 'Why does Raft use randomized election timers?',
        answer:
          'Randomized election timers prevent split votes by ensuring that one candidate will almost always time out and request votes before others, securing a majority quickly.',
        sourceStart: 511,
      },
      {
        question: 'What is the quorum requirement for a cluster of 5 nodes?',
        answer:
          '3 nodes (floor(5/2) + 1). Any two majorities of 3 will intersect at at least one node, preventing conflicting decisions.',
        sourceStart: 631,
      },
      {
        question: 'Can committed log entries ever be overwritten in Raft?',
        answer:
          'No. Once an entry is committed by a leader and replicated to a majority, Raft safety guarantees it will be present in future leaders’ logs forever.',
        sourceStart: 751,
      },
      {
        question: 'What happens to uncommitted entries from an old partitioned leader?',
        answer:
          'When the partitioned leader reconnects, the new leader forces it to overwrite conflicting uncommitted entries with the authoritative log sequence.',
        sourceStart: 873,
      },
    ],
    transcript: [
      {
        start: 0,
        end: 18,
        text: 'Welcome everyone to Lecture 4. Today we are diving into distributed consensus and state machine replication.',
      },
      {
        start: 19,
        end: 42,
        text: 'In any real-world cluster running across commodity hardware, machines crash, switches drop packets, and network partitions occur without warning.',
      },
      {
        start: 43,
        end: 78,
        text: 'If we want our storage engine or database to remain available while guaranteeing strict linearizable consistency, we cannot rely on a single primary node without failover safety.',
      },
      {
        start: 79,
        end: 125,
        text: 'This brings us to the fundamental paradigm known as State Machine Replication. If every replica starts in the exact same initial state and executes the exact same deterministic stream of log commands in identical order, all nodes will converge to the exact same final state.',
      },
      {
        start: 126,
        end: 180,
        text: 'Now, the hard part is: how do all nodes agree on the exact sequence of commands when messages can arrive out of order, be duplicated, or get dropped? That is the consensus problem.',
      },
      {
        start: 181,
        end: 245,
        text: 'Historically, Leslie Lamport’s Paxos was the gold standard, but Paxos is notoriously difficult to understand and even harder to implement correctly in software without subtle edge-case bugs.',
      },
      {
        start: 246,
        end: 320,
        text: 'In 2014, Ongaro and Ousterhout at Stanford introduced Raft. Raft was explicitly designed around understandability. It separates consensus into three clean sub-problems: leader election, log replication, and safety.',
      },
      {
        start: 321,
        end: 410,
        text: 'Let us examine leader election first. Every node in Raft operates in one of three states: Follower, Candidate, or Leader. At startup, all nodes begin as Followers.',
      },
      {
        start: 411,
        end: 510,
        text: 'If a Follower does not receive periodic heartbeats from a Leader within its election timeout, it transitions to Candidate, increments its current term, votes for itself, and broadcasts RequestVote RPCs.',
      },
      {
        start: 511,
        end: 630,
        text: 'Notice the brilliance of randomized election timers here. If all nodes timed out at the exact same millisecond, they would all vote for themselves simultaneously, causing a perpetual split vote. By randomizing timeouts between 150 and 300 milliseconds, one node almost always wins first.',
      },
      {
        start: 631,
        end: 750,
        text: 'Next, let us explore Quorums. In a five-node cluster, a quorum is three nodes. Because any two quorums of three out of five must intersect at least one node, you cannot have two leaders legitimately elected in the same term. This completely prevents split-brain scenarios.',
      },
      {
        start: 751,
        end: 872,
        text: 'Once elected, the Leader accepts client commands, appends them to its local log, and issues AppendEntries RPCs to all followers. Once a log entry is replicated across a majority, it is considered committed.',
      },
      {
        start: 873,
        end: 1005,
        text: 'The Leader then applies the committed entry to its state machine and returns the result to the client. On subsequent heartbeats, followers learn that the entry was committed and apply it locally as well.',
      },
      {
        start: 1006,
        end: 1124,
        text: 'To conclude today’s session: Raft guarantees the Leader Completeness property. If a log entry is committed in a given term, that entry will be present in the logs of the leaders for all higher-numbered terms. Next time, we will look at log compaction and snapshotting.',
      },
    ],
  },
  {
    id: 'lec-2',
    title: 'Deep Learning: Attention Mechanisms & Transformer Architectures',
    status: 'done',
    durationSec: 880, // ~14m 40s
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 days ago
    summary:
      'A comprehensive breakdown of the Transformer architecture (Vaswani et al., 2017). This lecture deconstructs the Scaled Dot-Product Attention mechanism, Query-Key-Value vector transformations, Multi-Head Attention, Rotary/Sinusoidal Positional Embeddings, and why parallel token processing obsoleted recurrent neural networks (RNNs/LSTMs) for sequence modeling.',
    keyTerms: [
      {
        term: 'Scaled Dot-Product Attention',
        definition:
          'Attention(Q, K, V) = softmax(Q * K^T / sqrt(d_k)) * V. Computes dynamic similarity weights between query and key tokens to aggregate values.',
      },
      {
        term: 'Multi-Head Attention',
        definition:
          'Linearly projecting queries, keys, and values into multiple subspace representations before applying attention in parallel, allowing the model to attend to different relationship facets.',
      },
      {
        term: 'Positional Encoding',
        definition:
          'Vectors injected into token representations to provide sequence order awareness, since raw self-attention is permutation-invariant.',
      },
      {
        term: 'FlashAttention',
        definition:
          'An exact, IO-aware algorithm that tiles softmax computation across GPU SRAM without materializing large intermediate N x N attention matrices in High Bandwidth Memory.',
      },
    ],
    flashcards: [
      {
        question: 'Why do we scale dot products by 1 / sqrt(d_k) in self-attention?',
        answer:
          'For large vector dimensions d_k, dot products grow large in magnitude, pushing softmax into regions with vanishing gradients. Scaling stabilizes gradients.',
        sourceStart: 396,
      },
      {
        question: 'Why do Transformers require positional encodings whereas RNNs do not?',
        answer:
          'Attention operations are order-agnostic (permutation-invariant); without positional information, token order would have no influence on attention weights.',
        sourceStart: 541,
      },
      {
        question: 'What is the computational complexity of standard self-attention with sequence length N?',
        answer:
          'O(N^2) quadratic time and memory complexity with respect to the sequence length due to the N x N attention weight matrix.',
        sourceStart: 711,
      },
    ],
    transcript: [
      {
        start: 0,
        end: 25,
        text: 'Good morning everyone. Today we are unpacking the architecture that powers modern foundation models: the Transformer.',
      },
      {
        start: 26,
        end: 80,
        text: 'Before Transformers, sequential models like LSTMs and GRUs processed tokens sequentially step-by-step. This sequential dependency fundamentally prevented full hardware parallelization across modern GPU tensors.',
      },
      {
        start: 81,
        end: 165,
        text: 'The breakthrough insight from "Attention Is All You Need" was replacing recurrent recurrent connections entirely with multi-head self-attention, allowing all tokens in a prompt to attend to each other simultaneously.',
      },
      {
        start: 166,
        end: 270,
        text: 'Let us break down the mathematical formulation. For each token, we produce three vectors via learned linear projections: a Query vector Q, a Key vector K, and a Value vector V.',
      },
      {
        start: 271,
        end: 395,
        text: 'Think of Query as what a token is looking for, Key as what a token offers, and Value as the actual payload content. We compute the dot product between Q and K transposed, divide by the square root of d_k, and apply softmax.',
      },
      {
        start: 396,
        end: 540,
        text: 'Why do we divide by square root of d_k? Because when dimensionality is large, dot products become huge, pushing the softmax function into regions with extremely small gradients. The scaling keeps backpropagation healthy.',
      },
      {
        start: 541,
        end: 710,
        text: 'Another crucial element is Positional Encoding. Because self-attention evaluates pairs of tokens independently of their spatial distance in the sequence, the operation is naturally permutation invariant. We must inject position vectors so the model knows syntax order.',
      },
      {
        start: 711,
        end: 880,
        text: 'Modern implementations utilize innovations like FlashAttention by Tri Dao, which tiles attention directly in GPU SRAM, bypassing memory bandwidth bottlenecks. Next week, we will examine causal masking in decoder-only architectures.',
      },
    ],
  },
  {
    id: 'lec-3',
    title: 'Compilers: Static Single Assignment & Intermediate Representations',
    status: 'done',
    durationSec: 945, // ~15m 45s
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 9).toISOString(), // 9 days ago
    summary:
      'An in-depth look at intermediate representations (IR) with a focus on Static Single Assignment (SSA) form in modern compilers like LLVM. Topics include dominance frontiers, phi-nodes, dead code elimination, and constant propagation over SSA graphs.',
    keyTerms: [
      {
        term: 'Static Single Assignment (SSA)',
        definition:
          'A compiler IR property where every variable is assigned a value exactly once, drastically simplifying data-flow analyses and optimization passes.',
      },
      {
        term: 'Phi Node (φ)',
        definition:
          'A pseudo-instruction placed at control-flow join points that selects a value based on which predecessor basic block executed immediately prior.',
      },
      {
        term: 'Dominance Frontier',
        definition:
          'The set of basic blocks where a given block’s strict dominance ends, indicating precisely where phi-nodes must be inserted for variable definitions.',
      },
    ],
    flashcards: [
      {
        question: 'What is the primary benefit of SSA form in compiler optimization?',
        answer:
          'SSA creates an explicit, direct 1:1 mapping between variable definitions and their uses (def-use chains), eliminating complex reaching definitions analyses.',
        sourceStart: 111,
      },
      {
        question: 'What is the role of a phi-node at a control flow merge point?',
        answer:
          'A phi-node resolves multiple reaching definitions from branching paths (e.g. if/else branches) by selecting the appropriate version based on runtime path execution.',
        sourceStart: 221,
      },
    ],
    transcript: [
      {
        start: 0,
        end: 35,
        text: 'Welcome back. Today we are studying one of the crowning achievements of compiler design: Static Single Assignment form, or SSA.',
      },
      {
        start: 36,
        end: 110,
        text: 'In source code, variables are mutated over and over inside loops and condition blocks. Tracking which definition reaches which use in raw assembly requires expensive iterative data-flow analysis.',
      },
      {
        start: 111,
        end: 220,
        text: 'Cytron and Ferrante in 1991 formalized SSA. The rule is deceptively simple: every variable name is assigned exactly once statically in the program text.',
      },
      {
        start: 221,
        end: 375,
        text: 'When control flows converge from an if-else block, we insert phi-nodes. A phi-node says: if we came from basic block 1, take value x1; if from basic block 2, take value x2.',
      },
      {
        start: 376,
        end: 580,
        text: 'This makes optimizations like Sparse Conditional Constant Propagation and Dead Code Elimination run in linear time rather than quadratic or cubic time.',
      },
      {
        start: 581,
        end: 945,
        text: 'LLVM IR is fundamentally built around SSA. In LLVM, every virtual register %1, %2 can only be assigned once. We will implement our own SSA construction algorithm in Lab 3.',
      },
    ],
  },
];

export interface MockApiOptions {
  simulatedProgressSpeedMs?: number; // how quickly stages advance
  simulateFailureForTitles?: string[]; // trigger failed state for testing
}

/**
 * Demo-mode quiz fixtures: two preloaded lectures ship with flashcards AND
 * quizzes. Every question is answerable from the transcript only, carries 4
 * distinct choices with exactly one correct answer, a one-line explanation,
 * and the sourceStart of the chunk it came from.
 */
const QUIZZES: Record<string, QuizQuestion[]> = {
  'lec-1': [
    {
      id: 'lec-1-q1',
      question: 'Which three states can a Raft node be in?',
      choices: [
        'Follower, Candidate, Leader',
        'Primary, Replica, Witness',
        'Proposer, Acceptor, Learner',
        'Coordinator, Cohort, Observer',
      ],
      answerIndex: 0,
      explanation: 'Raft nodes start as Followers and move to Candidate or Leader during elections.',
      sourceStart: 321,
    },
    {
      id: 'lec-1-q2',
      question: 'What range does Raft use for randomized election timeouts?',
      choices: ['150–300 milliseconds', '50–100 milliseconds', '1–2 seconds', '5–10 seconds'],
      answerIndex: 0,
      explanation: 'Randomized 150–300ms timeouts let one node win first and avoid split votes.',
      sourceStart: 511,
    },
    {
      id: 'lec-1-q3',
      question: 'What is the quorum size for a 5-node Raft cluster?',
      choices: ['3 nodes', '2 nodes', '4 nodes', 'All 5 nodes'],
      answerIndex: 0,
      explanation: 'A quorum is floor(5/2) + 1 = 3, so any two quorums overlap.',
      sourceStart: 631,
    },
    {
      id: 'lec-1-q4',
      question: 'Can a committed Raft log entry ever be overwritten?',
      choices: [
        'No — committed entries persist in all future leaders’ logs',
        'Yes — the next leader rewrites them',
        'Yes — when a partition heals',
        'Only if the term changes twice',
      ],
      answerIndex: 0,
      explanation: 'Raft safety guarantees committed entries survive every future election.',
      sourceStart: 751,
    },
  ],
  'lec-2': [
    {
      id: 'lec-2-q1',
      question: 'What is the scaled dot-product attention formula?',
      choices: [
        'softmax(Q·Kᵀ / √d_k)·V',
        'softmax(Q+V / d_k)·K',
        'sigmoid(Q·K)·V / d_k',
        'max(Q−K, 0)·V',
      ],
      answerIndex: 0,
      explanation: 'Query-key dot products are scaled, soft-maxed, then weight the values.',
      sourceStart: 271,
    },
    {
      id: 'lec-2-q2',
      question: 'Why divide attention scores by √d_k?',
      choices: [
        'To keep softmax out of vanishing-gradient regions',
        'To make attention matrices sparse',
        'To add positional information',
        'To reduce the parameter count',
      ],
      answerIndex: 0,
      explanation: 'Large dot products saturate softmax, so scaling keeps gradients healthy.',
      sourceStart: 396,
    },
    {
      id: 'lec-2-q3',
      question: 'Why do Transformers need positional encodings?',
      choices: [
        'Self-attention is permutation-invariant without them',
        'Softmax requires ordered inputs to converge',
        'They replace the feed-forward layers',
        'They compress the key matrix',
      ],
      answerIndex: 0,
      explanation: 'Attention ignores token order, so position vectors restore sequence order.',
      sourceStart: 541,
    },
  ],
};

export class MockLecternApi implements LecternApiClient {
  private lectures: Map<string, LectureDetail> = new Map();
  private progressMap: Map<string, { status: LectureStatus; percent: number }> = new Map();
  private options: MockApiOptions;

  constructor(options: MockApiOptions = {}) {
    this.options = {
      simulatedProgressSpeedMs: 1200,
      ...options,
    };
    // Initialize with seed lectures
    for (const lec of INITIAL_LECTURES) {
      this.lectures.set(lec.id, { ...lec });
      this.progressMap.set(lec.id, { status: lec.status, percent: 100 });
    }
  }

  /**
   * Helper to reset to initial state
   */
  reset(): void {
    this.lectures.clear();
    this.progressMap.clear();
    for (const lec of INITIAL_LECTURES) {
      this.lectures.set(lec.id, { ...lec });
      this.progressMap.set(lec.id, { status: lec.status, percent: 100 });
    }
  }

  /**
   * Helper to inspect internal mock state
   */
  getAllLecturesDirect(): LectureDetail[] {
    return Array.from(this.lectures.values());
  }

  /**
   * POST /lectures (multipart upload) -> {id}
   */
  async uploadLecture(file: File | Blob, title?: string): Promise<UploadLectureResponse> {
    await delay(400); // Simulate local file buffer ingestion
    const id = `lec-${Date.now()}`;
    const fallbackTitle =
      file instanceof File && file.name
        ? file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
        : 'Microphone Recording';

    const lectureTitle = title || fallbackTitle;
    const shouldFail = this.options.simulateFailureForTitles?.includes(lectureTitle);

    let audioUrl: string | undefined;
    if (typeof URL !== 'undefined' && URL.createObjectURL && file) {
      try {
        audioUrl = URL.createObjectURL(file);
      } catch {
        // ignore
      }
    }

    // Initial item in 'converting' state
    const newLecture: LectureDetail = {
      id,
      title: lectureTitle,
      status: 'converting',
      durationSec: 180, // estimated 3 mins
      createdAt: new Date().toISOString(),
      summary: '',
      keyTerms: [],
      flashcards: [],
      transcript: [],
      audioUrl,
    };

    this.lectures.set(id, newLecture);
    this.progressMap.set(id, { status: 'converting', percent: 8 });

    // Begin background stage progression simulation
    this.runStageProgression(id, lectureTitle, shouldFail);

    return { id };
  }

  private async runStageProgression(id: string, title: string, shouldFail?: boolean) {
    const stepDuration = this.options.simulatedProgressSpeedMs ?? 1000;

    const stages: Array<{ status: LectureStatus; percent: number }> = [
      { status: 'converting', percent: 15 },
      { status: 'transcribing', percent: 35 },
      { status: 'transcribing', percent: 52 },
      { status: 'embedding', percent: 68 },
      { status: 'summarizing', percent: 84 },
      { status: 'flashcards', percent: 94 },
      { status: 'done', percent: 100 },
    ];

    for (let i = 0; i < stages.length; i++) {
      await delay(stepDuration);
      const stage = stages[i];

      if (shouldFail && i === 2) {
        this.progressMap.set(id, { status: 'failed', percent: 45 });
        const lec = this.lectures.get(id);
        if (lec) lec.status = 'failed';
        return;
      }

      this.progressMap.set(id, { status: stage.status, percent: stage.percent });
      const lec = this.lectures.get(id);
      if (lec) {
        lec.status = stage.status;
      }
    }

    // Finish processing: populate realistic generated content for the uploaded lecture
    const lec = this.lectures.get(id);
    if (lec) {
      lec.status = 'done';
      lec.summary = `Processed offline lecture for "${title}". All Whisper speech recognition, vector chunking, and local LLM summarization completed directly on this workstation without external network requests.`;
      lec.keyTerms = [
        {
          term: 'Local Inference',
          definition:
            'Executing machine learning models (speech-to-text, embeddings, LLM generation) strictly using on-device hardware (CPU/GPU) without external API dependencies.',
        },
        {
          term: 'Voice Segmentation',
          definition:
            'Chunking recorded speech audio into discrete timestamped acoustic utterances for precise timestamp alignment.',
        },
        {
          term: 'Vector Indexing',
          definition:
            'Computing high-dimensional dense embeddings of transcript chunks for semantic retrieval during question answering.',
        },
      ];
      lec.flashcards = [
        {
          question: `What was the primary focus of "${title}"?`,
          answer:
            'Exploring the local lecture recording, automatic audio transcription, and offline knowledge extraction.',
          sourceStart: 0,
        },
        {
          question: 'Are audio files or transcripts ever sent to the cloud?',
          answer:
            'No. Lectern operates 100% offline; audio transcription, embeddings, and Q&A stay entirely on the local device.',
          sourceStart: 13,
        },
      ];
      lec.transcript = [
        {
          start: 0,
          end: 12,
          text: `Starting local capture for ${title}. Audio stream initialized via offline MediaRecorder.`,
        },
        {
          start: 13,
          end: 32,
          text: 'This lecture audio was transcribed locally using on-device Whisper models running on the user machine.',
        },
        {
          start: 33,
          end: 58,
          text: 'Key takeaways and flashcards were generated by an offline local language model directly from the transcript.',
        },
        {
          start: 59,
          end: 95,
          text: 'You can search across this transcript, click any timestamp to jump to the audio position, or query the cross-lecture assistant.',
        },
      ];
    }
  }

  /**
   * GET /lectures -> [{id,title,status,durationSec,createdAt}]
   */
  async getLectures(): Promise<LectureListItem[]> {
    await delay(150);
    return Array.from(this.lectures.values()).map((lec) => ({
      id: lec.id,
      title: lec.title,
      status: lec.status,
      durationSec: lec.durationSec ?? 0,
      createdAt: lec.createdAt ?? new Date().toISOString(),
    }));
  }

  /**
   * GET /lectures/:id -> {id,title,status,transcript:[{start,end,text}],summary,keyTerms:[{term,definition}],flashcards:[{question,answer}]}
   */
  async getLecture(id: string): Promise<LectureDetail> {
    await delay(200);
    const lec = this.lectures.get(id);
    if (!lec) {
      throw new Error(`Lecture with id "${id}" not found.`);
    }
    return { ...lec };
  }

  /**
   * GET /lectures/:id/progress -> {status,percent}; status is one of converting|transcribing|embedding|summarizing|flashcards|done|failed
   */
  async getLectureProgress(id: string): Promise<LectureProgress> {
    await delay(100);
    const progress = this.progressMap.get(id);
    if (!progress) {
      // Default to done if lecture exists
      const lec = this.lectures.get(id);
      if (lec) {
        return { status: lec.status, percent: lec.status === 'done' ? 100 : 0 };
      }
      throw new Error(`Progress for lecture "${id}" not found.`);
    }
    return { ...progress };
  }

  /**
   * GET /lectures/:id/quiz -> [{id,question,choices,answerIndex,explanation,sourceStart}]
   * Validates shape (4 distinct choices, valid answerIndex) before returning.
   */
  async getQuiz(id: string): Promise<QuizQuestion[]> {
    await delay(200);
    const quiz = QUIZZES[id];
    if (!quiz) {
      return [];
    }
    for (const q of quiz) {
      if (
        !Array.isArray(q.choices) ||
        q.choices.length !== 4 ||
        new Set(q.choices).size !== 4 ||
        q.answerIndex < 0 ||
        q.answerIndex > 3
      ) {
        throw new Error(`Invalid quiz fixture for lecture "${id}" (question "${q.id}").`);
      }
    }
    return quiz.map((q) => ({ ...q, choices: [...q.choices] as QuizQuestion['choices'] }));
  }

  /**
   * POST /ask {question} -> {answer,citations:[{lectureId,lectureTitle,start}]}
   */
  async ask(question: string): Promise<AskResponse> {
    await delay(600); // Simulate local embedding search + local LLM response generation

    const q = question.toLowerCase().trim();

    // 1. Raft / Consensus questions
    if (
      q.includes('raft') ||
      q.includes('consensus') ||
      q.includes('quorum') ||
      q.includes('leader') ||
      q.includes('split brain') ||
      q.includes('paxos')
    ) {
      return {
        answer:
          'In distributed systems, Raft achieves consensus through a leader-based model with three states: Follower, Candidate, and Leader. Quorums (majority overlap) ensure that only one leader can be elected per term, strictly preventing split-brain scenarios. Randomized election timeouts (150-300ms) prevent split-vote deadlocks during elections.',
        citations: [
          {
            lectureId: 'lec-1',
            lectureTitle: 'Distributed Systems: Raft Consensus & State Machine Replication',
            start: 321,
          },
          {
            lectureId: 'lec-1',
            lectureTitle: 'Distributed Systems: Raft Consensus & State Machine Replication',
            start: 511,
          },
          {
            lectureId: 'lec-1',
            lectureTitle: 'Distributed Systems: Raft Consensus & State Machine Replication',
            start: 631,
          },
        ],
      };
    }

    // 2. Transformer / Attention questions
    if (
      q.includes('transformer') ||
      q.includes('attention') ||
      q.includes('query') ||
      q.includes('positional') ||
      q.includes('scaling') ||
      q.includes('flashattention') ||
      q.includes('d_k')
    ) {
      return {
        answer:
          'Scaled Dot-Product Attention transforms input representations into Query, Key, and Value vectors via learned projections. Scaling by 1 / sqrt(d_k) prevents dot products from growing excessively large, which would cause vanishing gradients in the softmax. Positional encodings provide sequence order awareness since self-attention is permutation-invariant.',
        citations: [
          {
            lectureId: 'lec-2',
            lectureTitle: 'Deep Learning: Attention Mechanisms & Transformer Architectures',
            start: 166,
          },
          {
            lectureId: 'lec-2',
            lectureTitle: 'Deep Learning: Attention Mechanisms & Transformer Architectures',
            start: 396,
          },
          {
            lectureId: 'lec-2',
            lectureTitle: 'Deep Learning: Attention Mechanisms & Transformer Architectures',
            start: 541,
          },
        ],
      };
    }

    // 3. Compiler / SSA questions
    if (
      q.includes('ssa') ||
      q.includes('compiler') ||
      q.includes('phi') ||
      q.includes('llvm') ||
      q.includes('dead code')
    ) {
      return {
        answer:
          'Static Single Assignment (SSA) form requires that every variable is statically assigned exactly once. At control-flow merge points (such as the exit of an if-else block), phi-nodes select the active value based on the predecessor block executed at runtime. This turns data-flow analyses into fast linear-time passes.',
        citations: [
          {
            lectureId: 'lec-3',
            lectureTitle: 'Compilers: Static Single Assignment & Intermediate Representations',
            start: 111,
          },
          {
            lectureId: 'lec-3',
            lectureTitle: 'Compilers: Static Single Assignment & Intermediate Representations',
            start: 221,
          },
        ],
      };
    }

    // 4. Privacy / Offline questions
    if (q.includes('offline') || q.includes('privacy') || q.includes('gpu') || q.includes('data')) {
      return {
        answer:
          'Lectern is engineered specifically as an offline lecture assistant. Speech recognition (Whisper), text embeddings, and language model inference run entirely on your local GPU/CPU hardware. No audio bytes or queries ever leave this machine.',
        citations: [
          {
            lectureId: 'lec-1',
            lectureTitle: 'Distributed Systems: Raft Consensus & State Machine Replication',
            start: 0,
          },
        ],
      };
    }

    // 5. Default "Not covered in your lectures."
    return {
      answer: 'Not covered in your lectures.',
      citations: [],
    };
  }
}

export const createMockApiClient = (options?: MockApiOptions): MockLecternApi => {
  return new MockLecternApi(options);
};
