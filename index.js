
```javascript
import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline";

const client = new Anthropic();

interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string;
  userAnswer?: string;
  isCorrect?: boolean;
}

interface QuizState {
  questions: Question[];
  currentQuestionIndex: number;
  score: number;
  totalQuestions: number;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function generateQuizQuestions(): Promise<Question[]> {
  console.log("\n📚 Generando preguntas del quiz...\n");

  const prompt = `Genera 5 preguntas de opción múltiple sobre conocimientos generales.
Para cada pregunta, proporciona:
1. La pregunta
2. Cuatro opciones (A, B, C, D)
3. La respuesta correcta (solo la letra)

Formato de respuesta JSON:
[
  {
    "question": "¿Cuál es la capital de Francia?",
    "options": ["Londres", "París", "Berlín", "Madrid"],
    "correctAnswer": "B"
  }
]

Asegúrate de que sea válido JSON válido y contiene exactamente 5 preguntas.`;

  const message = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";

  const jsonMatch = responseText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("No se pudo extraer JSON de la respuesta");
  }

  const questionsData = JSON.parse(jsonMatch[0]);

  return questionsData.map((q: Question, index: number) => ({
    id: index + 1,
    question: q.question,
    options: q.options,
    correctAnswer: q.correctAnswer,
  }));
}

async function displayQuestion(
  quizState: QuizState,
  currentQuestion: Question
): Promise<void> {
  console.log(
    `\n${"=".repeat(60)}\nPregunta ${currentQuestion.id} de ${quizState.totalQuestions}\n${"=".repeat(60)}`
  );
  console.log(`\n❓ ${currentQuestion.question}\n`);

  currentQuestion.options.forEach((option, index) => {
    console.log(
      `${String.fromCharCode(65 + index)}) ${option}` // A), B), C), D)
    );
  });
}

function validateAnswer(answer: string): boolean {
  return /^[A-D]$/i.test(answer);
}

function checkAnswer(
  userAnswer: string,
  correctAnswer: string
): { isCorrect: boolean; correctAnswerIndex: number } {
  const userIndex = userAnswer.toUpperCase().charCodeAt(0) - 65;
  const correctIndex = correctAnswer.toUpperCase().charCodeAt(0) - 65;

  return {
    isCorrect: userIndex === correctIndex,
    correctAnswerIndex: correctIndex,
  };
}

async function runQuiz(): Promise<void> {
  console.log("\n🎯 QUIZ DE CONOCIMIENTOS GENERALES 🎯\n");
  console.log(
    "Responde las siguientes preguntas de opción múltiple (A, B, C, D)"
  );

  let questions: Question[];
  try {
    questions = await generateQuizQuestions();
  } catch (error) {
    console.error("Error al generar preguntas:", error);
    process.exit(1);
  }

  const quizState: QuizState = {
    questions,
    currentQuestionIndex: 0,
    score: 0,
    totalQuestions: questions.length,
  };

  for (let i = 0; i < quizState.totalQuestions; i++) {
    quizState.currentQuestionIndex = i;
    const currentQuestion = quizState.questions[i];

    await displayQuestion(quizState, currentQuestion);

    let userAnswer: string;
    let isValidAnswer = false;

    while (!isValidAnswer) {
      userAnswer = await question(
        "Tu respuesta (A/B/C/D): "
      );
      if (validateAnswer(userAnswer)) {
        isValidAnswer = true;
      } else {
        console.log(
          "❌ Por favor, ingresa una respuesta válida (A, B, C o D)."
        );
      }
    }

    const result = checkAnswer(userAnswer, currentQuestion.correctAnswer);
    currentQuestion.userAnswer = userAnswer.toUpperCase();
    currentQuestion.isCorrect = result.isCorrect;

    if (result.isCorrect) {
      console.log("✅ ¡Correcto!");
      quizState.score++;
    } else {
      console.log(
        `❌ Incorrecto. La respuesta correcta es: ${String.fromCharCode(65 + result.correctAnswerIndex)}) ${currentQuestion.options[result.correctAnswerIndex]}`
      );
    }

    console.log(`Puntuación actual: ${quizState.score}/${quizState.totalQuestions}`);
  }

  displayResults(quizState);
}

function displayResults(quizState: QuizState): void {
  const percentage = Math.