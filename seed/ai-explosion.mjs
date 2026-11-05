// Builds the network "The AI Explosion: the technologies behind the boom" through the Graphin API.
//
//   node seed/ai-explosion.mjs                 (uses http://localhost:8100)
//   node seed/ai-explosion.mjs http://localhost:5173
//
// Every link is a real page. Pages that refuse embedding are noted in their commentary, and the
// canvas shows an "Open ↗" link for them. Run it once: if the network already exists, it stops.

const BASE = process.argv[2] || 'http://localhost:8100';
const NETWORK_NAME = 'The AI Explosion: the technologies behind the boom';

// Columns are themes, left to right. Each row inside a column is 200 px lower than the last.
const COLUMNS = {
  foundations: 0,
  data: 420,
  architectures: 840,
  language: 1260,
  milestones: 1680,
};

// key, title, url (omit for notes), type (notes only), commentary, column
const NODES = [
  // ---- Foundations: how machines learn from examples
  { key: 'perceptron', column: 'foundations', title: 'Perceptron', url: 'https://en.wikipedia.org/wiki/Perceptron',
    commentary: 'Frank Rosenblatt\'s 1958 learning machine: a single layer of weighted inputs that adjusts its weights from labelled examples. It showed that a machine could learn a rule from data rather than having the rule written by hand.' },
  { key: 'backprop', column: 'foundations', title: 'Backpropagation', url: 'https://en.wikipedia.org/wiki/Backpropagation',
    commentary: 'Propagates the error at the output backwards through every layer, so each weight gets a gradient. Rumelhart, Hinton and Williams popularised it in 1986; without an efficient way to compute these gradients, deep networks could not be trained.' },
  { key: 'sgd', column: 'foundations', title: 'Stochastic gradient descent', url: 'https://en.wikipedia.org/wiki/Stochastic_gradient_descent',
    commentary: 'The optimiser that does the learning: each step moves the weights a little against the gradient, using a small batch of examples. Nearly every model in this network is trained with a variant of it, such as Adam.' },
  { key: 'deep-learning-book', column: 'foundations', title: 'Deep Learning (the textbook)', url: 'https://www.deeplearningbook.org/',
    commentary: 'Goodfellow, Bengio and Courville (2016), free online. The standard reference for the mathematics behind backpropagation, regularisation and optimisation. Read it alongside the Wikipedia pages.' },
  { key: 'karpathy', column: 'foundations', title: 'The Unreasonable Effectiveness of Recurrent Neural Networks', url: 'https://karpathy.github.io/2015/05/21/rnn-effectiveness/',
    commentary: 'Andrej Karpathy\'s 2015 post. A character-level recurrent network trained on raw text learns spelling, grammar and even markup structure. A good intuition for why sequence models work before Transformers.' },

  // ---- Data and compute: what the models ate and what they ran on
  { key: 'imagenet', column: 'data', title: 'ImageNet', url: 'https://en.wikipedia.org/wiki/ImageNet',
    commentary: 'Deng et al. (2009): about 14 million labelled images in thousands of categories, and an annual competition on it. It gave the field a shared benchmark large enough for deep networks to show what they could do.' },
  { key: 'commoncrawl', column: 'data', title: 'Common Crawl', url: 'https://commoncrawl.org/',
    commentary: 'A free, regularly published archive of billions of web pages, collected since 2008. Much of the raw text used to pretrain large language models comes from crawls like this one, filtered and cleaned.' },
  { key: 'cuda', column: 'data', title: 'CUDA', url: 'https://en.wikipedia.org/wiki/CUDA',
    commentary: 'NVIDIA\'s programming model, released in 2007, for running general code on graphics processors. Neural networks are mostly large matrix multiplications, which GPUs do in parallel. CUDA made that programmable, and it is the base of most deep learning compute.' },
  { key: 'tpu', column: 'data', title: 'Tensor Processing Unit', url: 'https://en.wikipedia.org/wiki/Tensor_Processing_Unit',
    commentary: 'Google\'s chip designed specifically for neural network workloads. It was used inside Google from about 2015 and was announced publicly in 2016. Custom accelerators like this one let training scale beyond what general hardware offered.' },
  { key: 'moore', column: 'data', title: 'Moore\'s law', url: 'https://en.wikipedia.org/wiki/Moore%27s_law',
    commentary: 'The observation that transistor counts on a chip roughly double every two years. Cheap, plentiful computation is the reason models could keep growing. Moore\'s law has slowed, which is why accelerators and parallelism matter more now.' },
  { key: 'pytorch', column: 'data', title: 'PyTorch', url: 'https://pytorch.org/',
    commentary: 'An open-source deep learning framework from Meta\'s AI research group, released in 2016. Its dynamic computation graph made research code easy to write and debug, and it is now the dominant framework for training new models.' },

  // ---- Architectures: the model designs that changed what was possible
  { key: 'cnn', column: 'architectures', title: 'Convolutional neural network', url: 'https://en.wikipedia.org/wiki/Convolutional_neural_network',
    commentary: 'Yann LeCun\'s design (LeNet, 1989 onwards) that slides the same small filters across an image. Sharing weights across positions makes it efficient and lets it learn visual features directly from pixels.' },
  { key: 'alexnet', column: 'architectures', title: 'AlexNet', url: 'https://en.wikipedia.org/wiki/AlexNet',
    commentary: 'Krizhevsky, Sutskever and Hinton (NeurIPS 2012). A deep convolutional network trained on two GPUs won the ImageNet challenge by a wide margin. This result is usually taken as the start of the modern deep learning boom.' },
  { key: 'dropout', column: 'architectures', title: 'Dropout', url: 'https://en.wikipedia.org/wiki/Dropout_(neural_networks)',
    commentary: 'Srivastava et al. (JMLR, 2014): randomly switch off units during training, so the network cannot rely on any single path. A simple regulariser that made very large networks practical to train without memorising their data.' },
  { key: 'resnet', column: 'architectures', title: 'Residual neural network', url: 'https://en.wikipedia.org/wiki/Residual_neural_network',
    commentary: 'He et al. (2015): skip connections let each layer learn a correction to its input. This made networks with over 100 layers trainable, and the same idea of residual connections appears in Transformers.' },
  { key: 'lstm', column: 'architectures', title: 'Long short-term memory', url: 'https://en.wikipedia.org/wiki/Long_short-term_memory',
    commentary: 'Hochreiter and Schmidhuber (1997): gated memory cells that keep information over long sequences. LSTMs were the standard for speech, translation and text until attention-based models replaced them.' },
  { key: 'gan', column: 'architectures', title: 'Generative adversarial network', url: 'https://en.wikipedia.org/wiki/Generative_adversarial_network',
    commentary: 'Goodfellow et al. (2014, arXiv 1406.2661): a generator and a discriminator trained against each other. GANs produced the first widely convincing synthetic images and started the generative era.' },
  { key: 'vae', column: 'architectures', title: 'Variational autoencoder', url: 'https://en.wikipedia.org/wiki/Variational_autoencoder',
    commentary: 'Kingma and Welling (2013, arXiv 1312.6114): an encoder and decoder trained so the hidden space is smooth enough to sample from. A probabilistic route to generation that many later latent-space models build on.' },
  { key: 'attention', column: 'architectures', title: 'Attention (machine learning)', url: 'https://en.wikipedia.org/wiki/Attention_(machine_learning)',
    commentary: 'Bahdanau, Cho and Bengio (2014, arXiv 1409.0473): a translation model looks back at every source word when producing each output word, instead of squeezing the sentence into one vector. The idea that Transformers later made the whole architecture.' },
  { key: 'transformer', column: 'architectures', title: 'Transformer (deep learning architecture)', url: 'https://en.wikipedia.org/wiki/Transformer_(deep_learning_architecture)',
    commentary: 'Vaswani et al. (2017), "Attention Is All You Need", arXiv 1706.03762. It removes recurrence and relies on self-attention over the whole sequence, so every position is processed in parallel on GPUs. Almost every large model that followed is built on it.' },
  { key: 'vit', column: 'architectures', title: 'Vision transformer', url: 'https://en.wikipedia.org/wiki/Vision_transformer',
    commentary: 'Dosovitskiy et al. (2020, arXiv 2010.11929): cut an image into patches and treat them as tokens. With enough data, the plain Transformer matched or beat convolutional networks on image tasks.' },
  { key: 'diffusion', column: 'architectures', title: 'Diffusion model', url: 'https://en.wikipedia.org/wiki/Diffusion_model',
    commentary: 'Ho et al. (2020, arXiv 2006.11239, denoising diffusion): learn to reverse a gradual process that adds noise to images. Diffusion models now drive most high-quality image generators, including Stable Diffusion.' },
  { key: 'clip', column: 'architectures', title: 'Contrastive Language-Image Pre-training', url: 'https://en.wikipedia.org/wiki/Contrastive_Language-Image_Pre-training',
    commentary: 'Radford et al. (2021, arXiv 2103.00020): image and text encoders trained together on about 400 million image–caption pairs, so matching pairs land close together. This shared space is how text-to-image systems understand prompts.' },
  { key: 'moe', column: 'architectures', title: 'Mixture of experts', url: 'https://en.wikipedia.org/wiki/Mixture_of_experts',
    commentary: 'Shazeer et al. (2017, arXiv 1701.06538): a router sends each input to a few specialist sub-networks. A model can hold far more parameters without every token paying the full compute cost.' },

  // ---- Language and science: the models that read and write
  { key: 'word2vec', column: 'language', title: 'Word2vec', url: 'https://en.wikipedia.org/wiki/Word2vec',
    commentary: 'Mikolov et al. (2013, arXiv 1301.3781): learns word vectors from raw text, so words used in similar contexts end up with similar vectors. Cheap embeddings at scale, and the first step toward representing meaning numerically.' },
  { key: 'bpe', column: 'language', title: 'Byte-pair encoding', url: 'https://en.wikipedia.org/wiki/Byte-pair_encoding',
    commentary: 'Splits text into frequent sub-word pieces, so a fixed vocabulary can spell any word in any language. The tokenisation method used by GPT-style models, and why they count tokens rather than words.' },
  { key: 'self-sup', column: 'language', title: 'Self-supervised learning', url: 'https://en.wikipedia.org/wiki/Self-supervised_learning',
    commentary: 'The model creates its own training task from unlabelled data, such as predicting the next word or a hidden one. This removed the need for human labels at the scale of the web, and it is how BERT and GPT are trained.' },
  { key: 'scaling', column: 'language', title: 'Scaling laws', url: 'https://en.wikipedia.org/wiki/Scaling_laws',
    commentary: 'Kaplan et al. (2020, arXiv 2001.08361): loss falls predictably as a power law in parameters, data and compute. This justified spending on bigger models. Hoffmann et al. (2022, Chinchilla, arXiv 2203.15556) later showed that data should grow alongside model size.' },
  { key: 'llm', column: 'language', title: 'Large language model', url: 'https://en.wikipedia.org/wiki/Large_language_model',
    commentary: 'Models of this kind, such as GPT-3 (2020, arXiv 2005.14165, 175 billion parameters), can perform new tasks from a few examples written in the prompt. The entry point of the era that followed.' },
  { key: 'rag', column: 'language', title: 'Retrieval-augmented generation', url: 'https://en.wikipedia.org/wiki/Retrieval-augmented_generation',
    commentary: 'Lewis et al. (2020, arXiv 2005.11401): retrieve relevant documents at question time and give them to the model. This grounds answers in sources the user can check, and most business LLM systems use some form of it.' },
  { key: 'rlhf', column: 'language', title: 'Reinforcement learning from human feedback', url: 'https://en.wikipedia.org/wiki/Reinforcement_learning_from_human_feedback',
    commentary: 'Ouyang et al. (2022, InstructGPT, arXiv 2203.02155): people rank model answers, and a reward model trained on those rankings steers the language model. This is what turned a raw language model into an assistant people can use.' },
  { key: 'llama', column: 'language', title: 'LLaMA (Meta AI)', url: 'https://ai.meta.com/llama/',
    commentary: 'Meta released LLaMA in February 2023 (arXiv 2302.13971) with open weights for researchers. Open models let many groups study, fine-tune and deploy language models outside the largest companies.' },
  { key: 'distill', column: 'architectures', title: 'Augmented RNNs (Distill)', url: 'https://distill.pub/2016/augmented-rnns/',
    commentary: 'Olah and Carter (Distill, 2016): attention and other memory mechanisms for recurrent networks, shown with interactive figures. Good visual background for the step from LSTMs to attention.' },
  { key: 'jalammar', column: 'language', title: 'The Illustrated Transformer', url: 'https://jalammar.github.io/illustrated-transformer/',
    commentary: 'Jay Alammar\'s step-by-step diagrams of queries, keys, values and multi-head attention. The easiest visual way in if the Transformer paper feels dense.' },
  { key: 'weng', column: 'language', title: 'The Transformer Family Version 2.0', url: 'https://lilianweng.github.io/posts/2023-01-27-the-transformer-family-v2/',
    commentary: 'Lilian Weng\'s survey of Transformer variants: efficient attention, memory, positional encodings and more. A good map of what changed after 2017.' },
  { key: 'd2l', column: 'language', title: 'Dive into Deep Learning', url: 'https://d2l.ai/',
    commentary: 'An interactive, open textbook with runnable code. Its chapters on attention and Transformers are a practical way to build the intuition used in this network.' },

  // ---- Milestones: where the technology met the public
  { key: 'alphago', column: 'milestones', title: 'AlphaGo', url: 'https://en.wikipedia.org/wiki/AlphaGo',
    commentary: 'DeepMind\'s program beat Lee Sedol 4–1 at Go in March 2016, using deep networks with reinforcement learning and tree search. It showed that learned systems could master problems long thought out of reach.' },
  { key: 'alphafold', column: 'milestones', title: 'AlphaFold', url: 'https://en.wikipedia.org/wiki/AlphaFold',
    commentary: 'AlphaFold 2 (2020) predicted protein structures with accuracy close to experimental methods at CASP14. It uses attention over sequences and structures, the same family of ideas as the Transformer, applied to biology.' },
  { key: 'chatgpt', column: 'milestones', title: 'ChatGPT', url: 'https://en.wikipedia.org/wiki/ChatGPT',
    commentary: 'OpenAI released ChatGPT on 30 November 2022. It combined a large language model with RLHF in a chat interface, and it brought these systems to the public at scale.' },

  // ---- Notes: synthesis written for this network
  { key: 'note-ingredients', type: 'note', column: 'foundations', title: 'Note: three ingredients met at once', top: true,
    commentary: 'The boom needed data (ImageNet, Common Crawl), cheap parallel compute (CUDA, TPUs, Moore\'s law) and better learning methods (backpropagation, SGD, dropout, attention, Transformers). Each of the three was necessary, and none was enough alone.' },
  { key: 'note-turning', type: 'note', column: 'architectures', title: 'Note: turning points', top: true,
    commentary: '2012: AlexNet shows deep vision on GPUs. 2017: the Transformer makes sequence modelling parallel. 2020: GPT-3 and scaling laws show that bigger is predictably better. 2022: RLHF and ChatGPT make the models usable by the public.' },
  { key: 'note-open', type: 'note', column: 'language', title: 'Note: open questions', top: true,
    commentary: 'Whether data runs out before scaling stops paying; how to reduce hallucination without retrieval; the energy and cost of training; and whether open-weight models should match closed ones. Add your own views as commentary on the relevant node.' },
  { key: 'note-reading', type: 'note', column: 'milestones', title: 'Note: how to read this network', top: true,
    commentary: 'Arrows show how one technology enabled or influenced another. Hover a node to preview its page, click to pin it, and press Edit to change its commentary. Some sites refuse embedding; use Open ↗ for those.' },
];

// [from, to, relationship]
const EDGES = [
  ['perceptron', 'backprop', 'LED_TO'],
  ['backprop', 'lstm', 'ENABLED'],
  ['sgd', 'backprop', 'USED_WITH'],
  ['sgd', 'alexnet', 'TRAINED'],
  ['sgd', 'transformer', 'TRAINED'],
  ['deep-learning-book', 'backprop', 'EXPLAINS'],
  ['karpathy', 'lstm', 'ILLUSTRATES'],
  ['word2vec', 'llm', 'FOUNDATION_FOR'],
  ['imagenet', 'alexnet', 'BENCHMARK_FOR'],
  ['commoncrawl', 'llm', 'DATA_FOR'],
  ['cuda', 'alexnet', 'ACCELERATED'],
  ['tpu', 'transformer', 'ACCELERATED'],
  ['moore', 'cuda', 'ENABLED'],
  ['pytorch', 'transformer', 'FRAMEWORK_FOR'],
  ['cnn', 'alexnet', 'ARCHITECTURE_OF'],
  ['dropout', 'alexnet', 'USED_IN'],
  ['alexnet', 'resnet', 'LED_TO'],
  ['resnet', 'transformer', 'INFLUENCED'],
  ['lstm', 'attention', 'IMPROVED_BY'],
  ['attention', 'transformer', 'ENABLED'],
  ['transformer', 'llm', 'ENABLED'],
  ['transformer', 'vit', 'ENABLED'],
  ['transformer', 'clip', 'ENABLED'],
  ['vit', 'clip', 'INFLUENCED'],
  ['gan', 'diffusion', 'CONTRASTS_WITH'],
  ['vae', 'gan', 'RELATED'],
  ['moe', 'llm', 'SCALES'],
  ['bpe', 'llm', 'USED_BY'],
  ['self-sup', 'llm', 'TRAINED'],
  ['scaling', 'llm', 'JUSTIFIED'],
  ['llm', 'rlhf', 'REFINED_BY'],
  ['rlhf', 'chatgpt', 'ENABLED'],
  ['llm', 'chatgpt', 'ENABLED'],
  ['rag', 'llm', 'ENHANCES'],
  ['llama', 'llm', 'IS_A'],
  ['pytorch', 'llama', 'FRAMEWORK_FOR'],
  ['alphago', 'rlhf', 'SHARES_METHODS_WITH'],
  ['attention', 'alphafold', 'USED_IN'],
  ['jalammar', 'transformer', 'ILLUSTRATES'],
  ['distill', 'attention', 'ILLUSTRATES'],
  ['weng', 'transformer', 'SURVEYS'],
  ['d2l', 'transformer', 'EXPLAINS'],
  ['note-ingredients', 'imagenet', 'SUMMARIZES'],
  ['note-ingredients', 'cuda', 'SUMMARIZES'],
  ['note-ingredients', 'transformer', 'SUMMARIZES'],
  ['note-turning', 'alexnet', 'SUMMARIZES'],
  ['note-turning', 'transformer', 'SUMMARIZES'],
  ['note-turning', 'chatgpt', 'SUMMARIZES'],
  ['note-open', 'llm', 'RAISES'],
];

async function call(method, path, body) {
  const response = await fetch(BASE + '/api' + path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${method} ${path}: ${data.error || response.status}`);
  return data;
}

async function main() {
  const existing = await call('GET', '/networks');
  if (existing.some((n) => n.name === NETWORK_NAME)) {
    console.log(`"${NETWORK_NAME}" already exists. Delete it in Graphin first, then run this again.`);
    return;
  }

  const network = await call('POST', '/networks', { name: NETWORK_NAME });
  const ids = new Map();
  const rowCount = new Map();

  for (const node of NODES) {
    const row = node.top ? -1 : (rowCount.get(node.column) ?? 0);
    if (!node.top) rowCount.set(node.column, row + 1);
    const x = COLUMNS[node.column];
    const y = node.top ? -320 : row * 200;
    const created = await call('POST', `/networks/${network.id}/nodes`, {
      type: node.type,
      url: node.url,
      title: node.title,
      commentary: node.commentary,
      x,
      y,
    });
    ids.set(node.key, created.id);
  }

  for (const [from, to, relationship] of EDGES) {
    if (!ids.has(from) || !ids.has(to)) {
      throw new Error(`Unknown key in edge ${from} -> ${to}`);
    }
    await call('POST', `/networks/${network.id}/edges`, {
      source_id: ids.get(from),
      target_id: ids.get(to),
      relationship,
    });
  }

  console.log(`Created "${NETWORK_NAME}": ${NODES.length} nodes, ${EDGES.length} relationships.`);
  console.log(`Open it at ${BASE}/#/networks/${network.id}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
