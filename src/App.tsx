/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import * as pdfjs from 'pdfjs-dist';
import { 
  Play, 
  Pause, 
  Square, 
  Upload, 
  FileText, 
  Settings, 
  Volume2, 
  VolumeX, 
  ChevronLeft, 
  ChevronRight,
  FastForward,
  Rewind,
  Maximize2,
  Minimize2,
  Type,
  BookOpen,
  Presentation as PresentationIcon,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface Word {
  text: string;
  index: number;
}

interface StructuredLine {
  words: Word[];
  isHeader: boolean;
  isEmpty: boolean;
}

interface Slide {
  title: string;
  content: string[];
  notes: string;
  type: string;
}

interface Presentation {
  title: string;
  slides: Slide[];
}

// --- PDF Worker Setup ---
// In a real environment, we'd use a CDN for the worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

export default function App() {
  const [content, setContent] = useState<string>('');
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'home' | 'reader' | 'presentation'>('home');
  const [isNotesVisible, setIsNotesVisible] = useState(true);
  const [words, setWords] = useState<Word[]>([]);
  const [structuredContent, setStructuredContent] = useState<StructuredLine[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(18);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [currentLang, setCurrentLang] = useState<'en' | 'hi'>('en');

  const SAMPLE_CONTENT = `Topic Title
Area & Volume

Overview
This lesson introduces 6th-grade students to the concepts of area for 2D shapes and volume for 3D figures. Students will explore these concepts through hands-on activities and see how they apply in real-world contexts.

Prerequisites
Basic multiplication skills
Understanding of length and width

Understanding Area
Area refers to the number of square units needed to cover a surface.
Explanation: The area of a rectangle is calculated by multiplying its length by its width. For example, if a rectangle has a length of 8 cm and a width of 4 cm, its area is 32 cm².
Examples: 
- A rectangle with a length of 5 cm and a width of 3 cm has an area of 15 cm².
- A square with sides of 2 m measures its area as 4 m².

Key Points:
- Area is always measured in square units.
- Different shapes will have different formulas for area calculation.

Understanding Volume
Volume is the measure of space a 3D shape occupies.
Explanation: To find the volume of a cuboid, multiply its length, width, and height. For example, a cuboid with dimensions 3 cm × 4 cm × 5 cm has a volume of 60 cm³.
Examples: 
- A shoebox (cuboid) with dimensions 10 cm × 20 cm × 5 cm has a volume of 1000 cm³.
- A cube with each side of 3 inches has a volume of 27 in³.

Key Points:
- Volume is measured in cubic units.
- More complex shapes require different volume formulas.

Definitions
Area: The amount of space inside a two-dimensional shape.
Volume: The amount of space inside a three-dimensional object.
Rectangle: A four-sided shape with opposite sides that are equal and right angles.
Cuboid: A three-dimensional shape with six rectangular faces.
Units: A standard measurement, such as square centimeters (cm²) for area and cubic centimeters (cm³) for volume.

Common Misconceptions
Misconception: Area and volume are the same.
Correction: Area measures 2D surfaces, while volume measures 3D spaces.
Misconception: Volume is always larger than area.
Correction: Volume and area measure different things and cannot be directly compared.

Practice Questions
Question: Find the area of a rectangle with a length of 6 cm and a width of 3 cm.
Answer: 18 cm²
Hint: Use the formula: Area = length × width.
Difficulty: medium
Type: Calculate Area

Question: What is the volume of a box with dimensions 4 cm × 5 cm × 3 cm?
Answer: 60 cm³
Hint: Use the formula: Volume = length × width × height.
Difficulty: medium
Type: Calculate Volume

Real-World Applications
- Calculating the amount of paint needed to cover a wall.
- Determining the volume of a container to hold a specific amount of liquid.
- Architects using area and volume in building designs.

Resources
Title: Understanding Area and Volume
Description: An educational video that visually explains the concepts of area and volume.
Type: Video
URL: https://www.example.com/video-understanding-area-volume

Next Steps
- Explore surface area of 3D shapes
- Learn about volumes of other geometric shapes like cylinders and spheres`;

  const SAMPLE_PPT_EN: Presentation = {
    title: "The Reign of Terror",
    slides: [
      {
        title: "Introduction to the Reign of Terror",
        content: [
          "Examination of the Reign of Terror during the French Revolution.",
          "Understanding its role and impact on French history.",
          "Exploration of the political and social dynamics leading to this period.",
          "Setting the stage for the emergence of revolutionary fervor."
        ],
        notes: "Introduce the Reign of Terror as a pivotal era in revolutionary France. Emphasize its historical importance. Address misconceptions about its scope and impact on various societal layers.",
        type: "title"
      },
      {
        title: "What Was the Reign of Terror?",
        content: [
          "A turbulent and radical phase of the French Revolution.",
          "Characterized by the mass execution of perceived revolution enemies.",
          "Spanned from September 1793 to July 1794.",
          "Led predominantly by the Committee of Public Safety.",
          "Aimed at protecting the revolution from internal and external threats.",
          "Promoted the concept of 'virtue through terror' to maintain revolutionary ideals.",
          "Implemented harsh legal measures like the Law of Suspects.",
          "Resulted in the execution of thousands, including notable figures."
        ],
        notes: "Clarify the timeline and objectives of this period. Emphasize the role of key revolutionary bodies and leaders. Discuss the societal pressures that fueled such radical actions.",
        type: "content"
      },
      {
        title: "Maximilien Robespierre: A Central Figure",
        content: [
          "Robespierre was an influential Jacobin leader.",
          "Advocated for stringent measures to protect the revolution.",
          "Instrumental in the establishment of the Reign of Terror.",
          "His policies were marked by radical and unyielding approaches.",
          "Influence led to the implementation of the Law of Suspects.",
          "His downfall mirrored the collapse of the Terror's extreme measures.",
          "Robespierre's legacy remains controversial and debated.",
          "Symbolized the extremes of revolutionary zeal and its consequences."
        ],
        notes: "Discuss Robespierre's role and influence during the Reign of Terror. Highlight his contribution to revolutionary policies and his ultimate demise. Address misconceptions about his intentions and the public's view of his actions.",
        type: "content"
      },
      {
        title: "Role of the Committee of Public Safety",
        content: [
          "Formed to defend the revolution against internal threats.",
          "Comprised of powerful figures like Robespierre and Danton.",
          "Became the de facto governing body during the Terror.",
          "Oversaw the implementation of revolutionary laws and decrees.",
          "Directed mass arrests, trials, and executions.",
          "Sought to centralize control and eliminate opposition.",
          "Facilitated the rise of radical policies and actions.",
          "Played a crucial role in the escalation of revolutionary violence."
        ],
        notes: "Explain the committee's formation and its significant influence. Highlight its strategies and the authoritative role it assumed. Discuss the implications of its decisions on French society.",
        type: "content"
      },
      {
        title: "The Guillotine: Symbol of Revolutionary Justice",
        content: [
          "Became an emblematic symbol of the Reign of Terror.",
          "Used extensively for public executions to instill fear.",
          "Represented swift and egalitarian justice under revolutionary law.",
          "Contributed to a culture of fear and compliance.",
          "Targeted both prominent figures and ordinary citizens.",
          "Became central to the political and social narrative of the time.",
          "Public executions were spectacles designed to reinforce power.",
          "Its legacy persists as a reminder of the era's brutality."
        ],
        notes: "Describe the guillotine's role and symbolism during this period. Discuss its impact on public perception and the atmosphere of fear. Clarify any misconceptions about its application and significance.",
        type: "content"
      },
      {
        title: "Key Events: High-Profile Executions",
        content: [
          "Execution of King Louis XVI in January 1793 marked a turning point.",
          "Marie Antoinette's execution followed in October 1793.",
          "Political rival Georges Danton was also executed.",
          "Widespread purges targeted perceived enemies and dissidents.",
          "These events consolidated revolutionary power through terror.",
          "Public executions served as demonstrations of revolutionary resolve.",
          "Highlighted the regime's willingness to eliminate opposition.",
          "Created a climate of fear that permeated French society."
        ],
        notes: "Review significant executions and their implications. Discuss the impact on the revolution's political dynamics. Address misconceptions about the scale and targets of these actions.",
        type: "content"
      },
      {
        title: "Political Tensions and Law of Suspects",
        content: [
          "The Law of Suspects broadened the scope of arrests.",
          "Revolutionary tribunals expedited trials and executions.",
          "Fear was employed to suppress dissent and control population.",
          "Elimination of political rivals was a method to maintain power.",
          "The law was used to justify widespread purges.",
          "Contributed to the atmosphere of paranoia and suspicion.",
          "Revolutionary justice was often arbitrary and brutal.",
          "Reinforced the dominance of radical revolutionary factions."
        ],
        notes: "Explain the political climate and the use of fear as a tool. Discuss the rationale behind the legal measures and their effects. Address misconceptions about the motivations behind these actions.",
        type: "content"
      },
      {
        title: "Social and Cultural Impact",
        content: [
          "Short-term: Strengthened radical control over France.",
          "Long-term: Influenced perceptions of state power and human rights.",
          "Brought about significant shifts in the French political landscape.",
          "Highlighted the dangers associated with extremist ideologies.",
          "Set the stage for future political reforms in France.",
          "Impacted the collective consciousness of the French populace.",
          "Altered the course of the revolutionary government’s policies.",
          "Contributed to a legacy of caution against absolute power."
        ],
        notes: "Discuss the societal impacts of the Reign of Terror in both immediate and long-term contexts. Highlight the changes in political and social structures. Address misconceptions about its lasting effects.",
        type: "content"
      },
      {
        title: "Common Misconceptions",
        content: [
          "Misconception: Only the nobility was targeted during the Terror.",
          "Correction: Many common citizens were also executed.",
          "Misunderstandings about the motivations behind the Terror.",
          "Simplification of the role of fear and control in revolutionary France.",
          "Extent of the Terror's impact on all social classes often underestimated.",
          "The narrative of the Terror is more complex than often portrayed.",
          "Perception that the Terror was solely a result of radicalism.",
          "Importance of understanding the broader historical context."
        ],
        notes: "Clarify misconceptions regarding the Reign of Terror. Provide corrections with historical evidence. Prepare to address questions about the broader implications and nuances of this period.",
        type: "content"
      },
      {
        title: "Real World Connections",
        content: [
          "Understanding political fear tactics in today’s governance.",
          "Analyzing the impact of extremist ideologies on governments.",
          "Lessons on balancing security and liberty in modern states.",
          "Historical examples of power consolidation through fear.",
          "Implications for modern democratic societies and their governance.",
          "Exploring how history informs current political strategies.",
          "Recognizing the signs of authoritarian tendencies in leadership.",
          "Evaluating the long-term effects of revolutionary and radical policies."
        ],
        notes: "Connect historical events to contemporary political contexts. Discuss the relevance of the Reign of Terror in modern governance. Encourage students to reflect on historical lessons applicable today.",
        type: "content"
      },
      {
        title: "Lesson Summary",
        content: [
          "Recap of the Reign of Terror’s causes, events, and impacts.",
          "Discussion of key figures and their influential roles.",
          "Review of major events and societal transformations.",
          "Clarification of common misconceptions about this period.",
          "Highlighting connections to modern political systems.",
          "Reflection on the consequences of extremist governance."
        ],
        notes: "Summarize the key points covered in the lesson. Reinforce understanding of the Reign of Terror's complexity. Ensure students grasp the connections to modern issues and history.",
        type: "summary"
      },
      {
        title: "Preview of Next Lesson",
        content: [
          "Explore Napoleon’s rise to power following the Reign of Terror.",
          "Understand the transition from revolutionary France to empire.",
          "Analyze the impacts of Napoleon’s rule on France and Europe.",
          "Study the legacy of the French Revolution in shaping modern Europe.",
          "Connect today’s lesson to the upcoming exploration of Napoleon.",
          "Preview of Next Lesson: include precise historical/context detail that clarifies the sequence of events around The Reign of Terror.",
          "Highlight one cause-and-effect chain linked to The Reign of Terror and explain why it changed outcomes.",
          "Add one concrete classroom example tied to Preview of Next Lesson so students can apply the concept accurately."
        ],
        notes: "Provide a brief overview of what to expect in the next session. Build interest in the transition from revolution to empire. Highlight the continuity in the study of French history and its wider implications.",
        type: "content"
      },
      {
        title: "Concept 13",
        content: [
          "Class note point 13 for The Reign of Terror with detailed explanation and context.",
          "Sequence the explanation so students can follow cause, action, and consequence.",
          "Add one relatable example and one recall cue students can use during revision.",
          "Concept 13: include precise historical/context detail that clarifies the sequence of events around The Reign of Terror.",
          "Highlight one cause-and-effect chain linked to The Reign of Terror and explain why it changed outcomes.",
          "Add one concrete classroom example tied to Concept 13 so students can apply the concept accurately.",
          "Include a misconception check related to Concept 13 and provide the correction with evidence.",
          "Connect this point to assessment language by modeling how students should justify claims about The Reign of Terror."
        ],
        notes: "Teacher study note: include teaching cue and transition line.",
        type: "content"
      },
      {
        title: "Concept 14",
        content: [
          "Class note point 14 for The Reign of Terror with detailed explanation and context.",
          "Sequence the explanation so students can follow cause, action, and consequence.",
          "Add one relatable example and one recall cue students can use during revision.",
          "Concept 14: include precise historical/context detail that clarifies the sequence of events around The Reign of Terror.",
          "Highlight one cause-and-effect chain linked to The Reign of Terror and explain why it changed outcomes.",
          "Add one concrete classroom example tied to Concept 14 so students can apply the concept accurately.",
          "Include a misconception check related to Concept 14 and provide the correction with evidence.",
          "Connect this point to assessment language by modeling how students should justify claims about The Reign of Terror."
        ],
        notes: "Teacher study note: include teaching cue and transition line.",
        type: "content"
      },
      {
        title: "Concept 15",
        content: [
          "Class note point 15 for The Reign of Terror with detailed explanation and context.",
          "Sequence the explanation so students can follow cause, action, and consequence.",
          "Add one relatable example and one recall cue students can use during revision.",
          "Concept 15: include precise historical/context detail that clarifies the sequence of events around The Reign of Terror.",
          "Highlight one cause-and-effect chain linked to The Reign of Terror and explain why it changed outcomes.",
          "Add one concrete classroom example tied to Concept 15 so students can apply the concept accurately.",
          "Include a misconception check related to Concept 15 and provide the correction with evidence.",
          "Connect this point to assessment language by modeling how students should justify claims about The Reign of Terror."
        ],
        notes: "Teacher study note: include teaching cue and transition line.",
        type: "content"
      }
    ]
  };

  const SAMPLE_PPT_HI: Presentation = {
    title: "दो बैलों की कथा - मुंशी प्रेमचंद",
    slides: [
      {
        title: "पाठ का परिचय",
        content: [
          "मुंशी प्रेमचंद की कहानी 'दो बैलों की कथा' का संक्षिप्त परिचय",
          "कहानी के प्रमुख पात्र: हीरा और मोती",
          "कहानी का सामाजिक और सांस्कृतिक संदर्भ",
          "इस पाठ के माध्यम से मिलने वाली शिक्षा"
        ],
        notes: "इस स्लाइड में कहानी का संक्षिप्त परिचय दें जिससे छात्रों को कहानी की पृष्ठभूमि समझने में मदद मिले। मुख्य पात्रों का परिचय और उनका महत्त्व समझाएं।",
        type: "title"
      },
      {
        title: "कहानी की पृष्ठभूमि",
        content: [
          "कहानी का ग्रामीण परिवेश और उसकी विशेषताएं",
          "भारत के ग्रामीण समाज का चित्रण",
          "प्रेमचंद की लेखनी की विशेषताएं",
          "कहानी का कालखंड और उसकी प्रासंगिकता",
          "हीरा और मोती के माध्यम से दिखाया गया पशु-मानव संबंध",
          "ग्रामीण जीवन की कठिनाइयां और संघर्ष",
          "कहानी का नैतिक और सामाजिक संदेश",
          "प्रेमचंद की भाषा और शैली की विशिष्टता"
        ],
        notes: "कहानी का ग्रामीण परिवेश छात्रों को समझाएं। प्रेमचंद की भाषा शैली की विशेषताओं पर ध्यान दें। कहानी के नैतिक संदेश को स्पष्ट करें।",
        type: "content"
      },
      {
        title: "मुख्य पात्र",
        content: [
          "हीरा: साहसी और वफादार बैल",
          "मोती: समझदार और सहनशील बैल",
          "हीरा और मोती का आपसी संबंध",
          "पात्रों के माध्यम से लेखक का संदेश",
          "पात्रों के चरित्र की विशेषताएं",
          "इनका ग्रामीण जीवन में योगदान",
          "इनके माध्यम से समाज का चित्रण",
          "पात्रों की प्रेरणादायक भूमिका"
        ],
        notes: "प्रत्येक पात्र की विशेषताओं को छात्रों तक पहुंचाएं। उनके आपसी संबंध और सामाजिक योगदान पर चर्चा करें। पात्रों के माध्यम से प्राप्त होने वाले संदेश पर ध्यान दें।",
        type: "content"
      },
      {
        title: "कहानी की प्रमुख घटनाएं",
        content: [
          "हीरा और मोती की स्वतंत्रता की खोज",
          "दोनों बैलों की साहसिक यात्रा",
          "किसान से बैलों की विदाई",
          "साहस और धैर्य की परीक्षा",
          "बैलगाड़ी की घटना और उससे उत्पन्न संघर्ष",
          "मोती का घायल होना और हीरा की मदद",
          "दोनों बैलों की वापसी और समाज की प्रतिक्रिया",
          "घटनाओं के माध्यम से दिखाए गए सामाजिक मुद्दे"
        ],
        notes: "प्रत्येक घटना को विस्तार से चर्चा करें। हीरा और मोती के साहसिक कार्यों को छात्रों के समक्ष प्रस्तुत करें। घटनाओं के सामाजिक मुद्दों पर ध्यान दें।",
        type: "content"
      },
      {
        title: "कहानी का विषय और संदेश",
        content: [
          "स्वतंत्रता की चाहत और उसका महत्त्व",
          "साहस, धैर्य और मित्रता की भूमिका",
          "पशु-मानव संबंधों की गहराई",
          "सामाजिक न्याय और समानता का संदेश",
          "प्रेमचंद की लेखनी में समाज सुधार की झलक",
          "ग्रामीण जीवन की सच्चाई और संघर्ष",
          "पशुओं के माध्यम से जीवन के मूल्य",
          "कहानी के माध्यम से प्रेमचंद का सामाजिक दृष्टिकोण"
        ],
        notes: "कहानी के विषयों और संदेशों पर गहन चर्चा करें। प्रेमचंद के सामाजिक दृष्टिकोण को स्पष्ट करें। विद्यार्थियों को कहानी के नैतिक संदेश पर विचार करने के लिए प्रेरित करें।",
        type: "content"
      },
      {
        title: "प्रेमचंद की लेखनी की विशेषताएं",
        content: [
          "साधारण भाषा में गहरी बातें कहने की क्षमता",
          "ग्रामीण जीवन का वास्तविक चित्रण",
          "सामाजिक मुद्दों पर संवेदनशीलता",
          "पात्रों के माध्यम से जीवन के मूल्य दर्शाना",
          "कहानी में संदेश देने की शैली",
          "लेखक की मानवता और संवेदना",
          "प्रेमचंद की लेखनी का सामाजिक प्रभाव",
          "भारतीय साहित्य में प्रेमचंद का स्थान"
        ],
        notes: "प्रेमचंद की लेखनी की विशेषताओं पर जोर दें। उनकी भाषा शैली और सामाजिक दृष्टिकोण को समझाएं। कहानी के माध्यम से दिए गए संदेशों पर विचार करें।",
        type: "content"
      },
      {
        title: "कहानी की सांस्कृतिक और सामाजिक प्रासंगिकता",
        content: [
          "भारतीय ग्रामीण समाज का चित्रण",
          "सामाजिक सुधार की दिशा में प्रेमचंद का योगदान",
          "कहानी में दिखाए गए सामाजिक मुद्दे",
          "पशु-मानव संबंधों की सांस्कृतिक प्रासंगिकता",
          "समाज में समानता और न्याय की आवश्यकता",
          "ग्रामीण जीवन की कठिनाइयों का वर्णन",
          "साहित्यिक दृष्टिकोण से कहानी का महत्त्व",
          "कहानी का समय के साथ बदलता परिप्रेक्ष्य"
        ],
        notes: "कहानी की सामाजिक और सांस्कृतिक प्रासंगिकता पर चर्चा करें। प्रेमचंद के योगदान को छात्रों के सामने रखें। समाज में समानता और न्याय की आवश्यकता पर जोर दें।",
        type: "content"
      },
      {
        title: "कहानी की भाषा और शैली",
        content: [
          "सरल और स्पष्ट भाषा का प्रयोग",
          "संवेदनशीलता और मानवीयता का समावेश",
          "ग्रामीण बोली और संवाद की प्रमुखता",
          "भावनाओं का सजीव चित्रण",
          "प्राकृतिक और सामाजिक चित्रण की शैली",
          "पात्रों की संवाद शैली",
          "कहानी के प्रवाह में भाषा की भूमिका",
          "भाषा के माध्यम से पाठकों से जुड़ाव"
        ],
        notes: "कहानी की भाषा और शैली को गहनता से समझाएं। प्रेमचंद की लेखनी में संवेदनशीलता और मानवीयता पर ध्यान दें। भाषा के माध्यम से कहानी के प्रवाह को समझाएं।",
        type: "content"
      },
      {
        title: "कहानी का साहित्यिक महत्त्व",
        content: [
          "मुंशी प्रेमचंद का साहित्यिक योगदान",
          "कहानी का भारतीय साहित्य में स्थान",
          "पात्रों के माध्यम से समाज का चित्रण",
          "साहित्यिक दृष्टिकोण से कहानी की प्रासंगिकता",
          "सामाजिक संदेश और नैतिक मूल्यों का संचार",
          "कहानी की लोकप्रियता और प्रभाव",
          "पाठकों पर कहानी का प्रभाव",
          "कहानी का समय के साथ बदलता महत्त्व"
        ],
        notes: "कहानी के साहित्यिक महत्त्व पर चर्चा करें। साहित्य में प्रेमचंद के योगदान को स्पष्ट करें। कहानी की प्रासंगिकता और प्रभाव पर ध्यान दें।",
        type: "content"
      },
      {
        title: "कहानी के सामाजिक मुद्दे",
        content: [
          "ग्रामीण जीवन की कठिनाइयां",
          "सामाजिक असमानता और न्याय की कमी",
          "पशु-मानव संबंधों की गहराई",
          "सामाजिक सुधार की आवश्यकता",
          "कहानी में दिखाए गए संघर्ष",
          "समाज में समानता और न्याय की आवश्यकता",
          "सामाजिक मुद्दों का गहन चित्रण",
          "कहानी के माध्यम से सामाजिक जागरूकता"
        ],
        notes: "कहानी में दिखाए गए सामाजिक मुद्दों पर गहन चर्चा करें। सामाजिक असमानता और सुधार की आवश्यकता को छात्रों के सामने रखें। कहानी के माध्यम से सामाजिक जागरूकता पर जोर दें।",
        type: "content"
      },
      {
        title: "पाठ के मुख्य संदेश",
        content: [
          "साहस और धैर्य का महत्त्व",
          "मित्रता और विश्वास की भूमिका",
          "स्वतंत्रता की चाहत और संघर्ष",
          "पशु-मानव संबंधों की मानवीयता",
          "सामाजिक न्याय और समानता की आवश्यकता",
          "ग्रामीण जीवन की वास्तविकता",
          "संवेदनशीलता और मानवीयता का संदेश",
          "समाज में सुधार की दिशा में प्रेरणा"
        ],
        notes: "पाठ के मुख्य संदेश छात्रों को स्पष्ट करें। साहस, धैर्य और मित्रता के महत्त्व पर विचार करें। समाज में सुधार की दिशा में प्रेरणा दें।",
        type: "content"
      },
      {
        title: "कहानी के नैतिक और सांस्कृतिक मूल्य",
        content: [
          "नैतिक शिक्षा और समाज सुधार",
          "संवेदनशीलता और इंसानियत का संदेश",
          "सांस्कृतिक मान्यताएं और परंपराएं",
          "समाज में समानता और न्याय की आवश्यकता",
          "पशु-मानव संबंधों की सांस्कृतिक प्रासंगिकता",
          "कहानी का समाज पर प्रभाव",
          "मानवता और संवेदना का प्रसार",
          "कहानी के माध्यम से सांस्कृतिक जागरूकता"
        ],
        notes: "कहानी के नैतिक और सांस्कृतिक मूल्यों पर जोर दें। समाज में समानता और न्याय की आवश्यकता को स्पष्ट करें। कहानी के माध्यम से सांस्कृतिक जागरूकता पर विचार करें।",
        type: "content"
      },
      {
        title: "कहानी का पाठ्यकम में स्थान",
        content: [
          "शिक्षा में नैतिक मूल्यों का समावेश",
          "साहित्यिक दृष्टिकोण से पाठ्यक्रम की प्रासंगिकता",
          "कहानी के माध्यम से सामाजिक शिक्षा",
          "पाठ्यक्रम में कहानी का महत्त्व",
          "छात्रों के लिए नैतिक और सामाजिक शिक्षा",
          "कहानी का साहित्यिक प्रभाव",
          "साहित्य में प्रेमचंद का स्थान",
          "शिक्षा में कहानी का योगदान"
        ],
        notes: "कहानी का पाठ्यक्रम में स्थान और महत्त्व पर चर्चा करें। शिक्षा में नैतिक और सामाजिक मूल्यों के समावेश को स्पष्ट करें। साहित्य में कहानी का प्रभाव समझाएं।",
        type: "content"
      },
      {
        title: "पाठ का पुनरावलोकन",
        content: [
          "कहानी के मुख्य बिंदुओं का सारांश",
          "प्रमुख पात्रों और घटनाओं की पुनरावृत्ति",
          "कहानी के सामाजिक और सांस्कृतिक मुद्दे",
          "प्रेमचंद की लेखनी की विशेषताएं",
          "कहानी का नैतिक और सांस्कृतिक मूल्य",
          "पाठ के मुख्य संदेश और शिक्षाएं",
          "कहानी का साहित्यिक और पाठ्यक्रम में महत्त्व",
          "समाज पर कहानी का प्रभाव"
        ],
        notes: "कहानी के मुख्य बिंदुओं का सारांश प्रस्तुत करें। प्रमुख पात्रों, घटनाओं और संदेशों पर ध्यान दें। कहानी के सामाजिक और सांस्कृतिक मुद्दों की पुनरावृत्ति करें।",
        type: "content"
      },
      {
        title: "पाठ की समापन टिप्पणी",
        content: [
          "मुंशी प्रेमचंद की कहानी में सामाजिक और नैतिक मूल्यों का समावेश",
          "हीरा और मोती के माध्यम से साहस और मित्रता का संदेश",
          "कहानी का साहित्यिक महत्त्व और समाज पर प्रभाव",
          "ग्रामीण जीवन की कठिनाइयां और संघर्ष का वर्णन",
          "पाठ्यक्रम में कहानी का स्थान और शिक्षा में योगदान",
          "प्रेमचंद की लेखनी और कहानी का सामाजिक दृष्टिकोण"
        ],
        notes: "पाठ की समापन टिप्पणी में कहानी के समग्र महत्त्व और प्रभाव को स्पष्ट करें। प्रेमचंद की लेखनी और कहानी के सामाजिक दृष्टिकोण पर ध्यान दें। कहानी के नैतिक और साहित्यिक मूल्यों को छात्रों तक पहुंचाएं।",
        type: "summary"
      }
    ]
  };

  const loadSample = () => {
    // No-op or removed as requested
  };

  const loadPPTSample = (lang: 'en' | 'hi' = 'en') => {
    const sample = lang === 'en' ? SAMPLE_PPT_EN : SAMPLE_PPT_HI;
    setPresentation(sample);
    setFileName(lang === 'en' ? "Reign_of_Terror_Presentation.json" : "Do_Bailon_Ki_Katha.json");
    setViewMode('presentation');
    setCurrentSlideIndex(0);
    setCurrentLang(lang);
    stopReading();
  };

  const downloadTemplate = () => {
    const template = {
      presentation: {
        title: "Your Presentation Title",
        slides: [
          {
            title: "Slide Title",
            content: ["Bullet point 1", "Bullet point 2"],
            notes: "Speaker notes or study guide content goes here.",
            type: "content"
          }
        ]
      }
    };
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'presentation_template.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const synth = window.speechSynthesis;
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);

  // Initialize voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = synth.getVoices();
      setVoices(availableVoices);
      if (availableVoices.length > 0 && !selectedVoice) {
        setSelectedVoice(availableVoices[0].name);
      }
    };
    loadVoices();
    synth.onvoiceschanged = loadVoices;
    return () => { synth.onvoiceschanged = null; };
  }, [selectedVoice, synth]);

  // Process text into structured lines and words
  useEffect(() => {
    let textToProcess = '';
    if (viewMode === 'reader' && content) {
      textToProcess = content;
    } else if (viewMode === 'presentation' && presentation) {
      const slide = presentation.slides[currentSlideIndex];
      // Only include notes in the words array (for reading) if they are visible
      textToProcess = `${slide.title}\n\n${slide.content.join('\n')}${isNotesVisible ? `\n\nNotes: ${slide.notes}` : ''}`;
    }

    if (textToProcess) {
      const lines = textToProcess.split('\n');
      const allWords: Word[] = [];
      let globalWordIndex = 0;

      const structured = lines.map(lineText => {
        const trimmed = lineText.trim();
        const isEmpty = trimmed === '';
        
        // Simple heuristic for headers
        const isHeader = !isEmpty && (
          trimmed.length < 40 && 
          (
            /^[A-Z][a-z]+(\s[A-Z][a-z]+)*$/.test(trimmed) || 
            trimmed.endsWith(':') ||
            lineText.startsWith('Topic Title') ||
            lineText.startsWith('Overview') ||
            lineText.startsWith('Prerequisites') ||
            lineText.startsWith('Understanding') ||
            lineText.startsWith('Key Points') ||
            lineText.startsWith('Definitions') ||
            lineText.startsWith('Common Misconceptions') ||
            lineText.startsWith('Practice Questions') ||
            lineText.startsWith('Real-World Applications') ||
            lineText.startsWith('Resources') ||
            lineText.startsWith('Next Steps') ||
            (viewMode === 'presentation' && (lineText === presentation?.slides[currentSlideIndex].title || lineText.startsWith('Notes:')))
          )
        );

        const lineWords = trimmed.split(/\s+/).filter(w => w !== '').map(text => {
          const word = { text, index: globalWordIndex++ };
          allWords.push(word);
          return word;
        });

        return {
          words: lineWords,
          isHeader,
          isEmpty
        };
      });

      setWords(allWords);
      setStructuredContent(structured);
      wordRefs.current = new Array(allWords.length).fill(null);
    } else {
      setWords([]);
      setStructuredContent([]);
    }
  }, [content, presentation, currentSlideIndex, viewMode, isNotesVisible]);

  // Auto-scroll to current word
  useEffect(() => {
    if (currentWordIndex >= 0 && wordRefs.current[currentWordIndex]) {
      wordRefs.current[currentWordIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentWordIndex]);

  const stopReading = useCallback(() => {
    synth.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentWordIndex(-1);
  }, [synth]);

  const startReading = useCallback((startIndex = 0) => {
    if (words.length === 0) return;

    stopReading();

    const textToRead = words.slice(startIndex).map(w => w.text).join(' ');
    const utterance = new SpeechSynthesisUtterance(textToRead);
    
    // Set language for TTS based on content
    const isHindi = /[\u0900-\u097F]/.test(textToRead);
    utterance.lang = isHindi ? 'hi-IN' : 'en-US';
    
    utterance.rate = playbackRate;
    utterance.volume = isMuted ? 0 : volume;
    
    // Try to find a voice matching the detected language
    const suitableVoice = voices.find(v => v.lang.startsWith(isHindi ? 'hi' : 'en'));
    if (suitableVoice) {
      utterance.voice = suitableVoice;
    } else if (selectedVoice) {
      const voice = voices.find(v => v.name === selectedVoice);
      if (voice) utterance.voice = voice;
    }

    let wordOffset = startIndex;

    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        // Find the word index based on character offset
        // This is tricky because event.charIndex is relative to the *utterance* text
        // We can approximate by counting spaces or using a more robust mapping
        // For simplicity, we'll increment based on boundaries if possible, 
        // but SpeechSynthesis is notoriously inconsistent across browsers.
        // A better way is to read word by word, but that sounds choppy.
        // Let's try to map charIndex to our word array.
        
        let charCount = 0;
        for (let i = startIndex; i < words.length; i++) {
          const wordLength = words[i].text.length + 1; // +1 for space
          if (charCount <= event.charIndex && event.charIndex < charCount + wordLength) {
            setCurrentWordIndex(i);
            break;
          }
          charCount += wordLength;
        }
      }
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentWordIndex(-1);
    };

    utteranceRef.current = utterance;
    setIsPlaying(true);
    setIsPaused(false);
    synth.speak(utterance);
  }, [content, words, playbackRate, volume, isMuted, selectedVoice, voices, stopReading, synth]);

  const togglePlayPause = () => {
    if (!isPlaying) {
      startReading(currentWordIndex >= 0 ? currentWordIndex : 0);
    } else if (isPaused) {
      synth.resume();
      setIsPaused(false);
    } else {
      synth.pause();
      setIsPaused(true);
    }
  };

  const handleFileUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setIsLoading(true);
    setFileName(file.name);
    stopReading();

    try {
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        const text = await file.text();
        const json = JSON.parse(text);
        
        // Handle nested structure from user request
        let presentationData = null;
        if (json.presentation) {
          presentationData = json.presentation;
        } else if (json.data?.lesson_plan?.ppt_content?.presentation) {
          presentationData = json.data.lesson_plan.ppt_content.presentation;
        } else if (json.data?.version?.ppt_content?.presentation) {
          presentationData = json.data.version.ppt_content.presentation;
        } else if (json.data?.lesson_plan?.content_metadata?.ppt_content?.presentation) {
          presentationData = json.data.lesson_plan.content_metadata.ppt_content.presentation;
        } else if (json.data?.version?.content_metadata?.ppt_content?.presentation) {
          presentationData = json.data.version.content_metadata.ppt_content.presentation;
        } else if (json.data?.versions && Array.isArray(json.data.versions)) {
          // Find the latest version by version_number
          const latest = json.data.versions.reduce((prev: any, current: any) => {
            const prevNum = prev.version_number || 0;
            const currNum = current.version_number || 0;
            return (prevNum > currNum) ? prev : current;
          }, json.data.versions[0]);
          
          // Check if the latest version itself has the presentation data
          presentationData = latest?.ppt_content?.presentation || latest?.content_metadata?.ppt_content?.presentation;
        }

        if (presentationData) {
          setPresentation(presentationData);
          setViewMode('presentation');
          setCurrentSlideIndex(0);
        } else {
          throw new Error('Invalid presentation format');
        }
      } else if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n';
        }
        setContent(fullText);
        setViewMode('reader');
      } else {
        const text = await file.text();
        setContent(text);
        setViewMode('reader');
      }
    } catch (error) {
      console.error('Error reading file:', error);
      alert('Failed to read file. Please try a different one.');
    } finally {
      setIsLoading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFileUpload,
    multiple: false,
    accept: {
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'text/markdown': ['.md'],
      'application/json': ['.json']
    }
  });

  return (
    <div className={cn(
      "min-h-screen flex flex-col transition-colors duration-500",
      isDarkMode ? "bg-[#0a0a0a] text-white" : "bg-[#f5f5f0] text-[#1a1a1a]"
    )}>
      {/* Header */}
      <header className="p-6 flex justify-between items-center border-b border-white/10">
        <div className="flex items-center gap-3">
          {viewMode !== 'home' && (
            <button 
              onClick={() => {
                stopReading();
                setContent('');
                setPresentation(null);
                setFileName(null);
                setViewMode('home');
              }}
              className="p-2 hover:bg-white/10 rounded-full transition-colors mr-2"
              title="Go Back"
            >
              <ChevronLeft size={24} />
            </button>
          )}
          <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
            <FileText className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Lumina Reader</h1>
            {fileName && <p className="text-xs opacity-50 truncate max-w-[200px]">{fileName}</p>}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            {isDarkMode ? <Settings size={20} /> : <Settings size={20} />}
          </button>
          {!content && (
            <div {...getRootProps()} className="cursor-pointer">
              <input {...getInputProps()} />
              <button className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-all">
                <Upload size={16} />
                Upload File
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative flex flex-col overflow-hidden">
        {viewMode === 'home' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10">
            <div 
              {...getRootProps()}
              className={cn(
                "w-full max-w-2xl aspect-video border-2 border-dashed rounded-3xl flex flex-col items-center justify-center gap-4 transition-all cursor-pointer",
                isDragActive ? "border-orange-500 bg-orange-500/10" : "border-white/10 hover:border-white/20 hover:bg-white/5",
                isDarkMode ? "bg-white/5" : "bg-black/5 border-black/10"
              )}
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center gap-4"
              >
                <input {...getInputProps()} />
                <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center pointer-events-none">
                  <Upload className="text-orange-500" size={32} />
                </div>
                <div className="text-center pointer-events-none">
                  <h2 className="text-2xl font-semibold mb-2">Drop your file here</h2>
                  <p className="opacity-50">Supports PDF, TXT, MD, and JSON (PPT)</p>
                </div>
                <div className="flex flex-col gap-3 mt-4 w-full">
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        loadPPTSample('en');
                      }}
                      className="bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-2xl text-xs font-bold transition-all border border-white/10 flex items-center justify-center gap-2"
                    >
                      <PresentationIcon size={16} />
                      French Revolution (EN)
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        loadPPTSample('hi');
                      }}
                      className="bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-2xl text-xs font-bold transition-all border border-white/10 flex items-center justify-center gap-2"
                    >
                      <PresentationIcon size={16} />
                      दो बैलों की कथा (HI)
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.json';
                        input.onchange = (event: any) => {
                          const file = event.target.files[0];
                          if (file) handleFileUpload([file]);
                        };
                        input.click();
                      }}
                      className="bg-white/5 hover:bg-white/10 text-white px-4 py-3 rounded-2xl text-xs font-bold transition-all border border-white/5 flex items-center justify-center gap-2"
                    >
                      <Upload size={14} />
                      Import JSON
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadTemplate();
                      }}
                      className="bg-white/5 hover:bg-white/10 text-white px-4 py-3 rounded-2xl text-xs font-bold transition-all border border-white/5 flex items-center justify-center gap-2"
                    >
                      <Download size={14} />
                      Get Template
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        ) : viewMode === 'reader' ? (
          <div className="flex-1 overflow-y-auto px-6 py-10 md:px-20 lg:px-40" ref={scrollRef}>
            <div 
              className="max-w-3xl mx-auto leading-relaxed"
              style={{ fontSize: `${fontSize}px` }}
            >
              {structuredContent.map((line, lineIdx) => (
                <div 
                  key={lineIdx} 
                  className={cn(
                    "mb-2 min-h-[1em]",
                    line.isHeader ? "text-2xl font-bold mt-8 mb-4 text-orange-500" : "opacity-90",
                    line.isEmpty ? "h-4" : ""
                  )}
                >
                  {line.words.map((word) => (
                    <span
                      key={word.index}
                      ref={(el) => { wordRefs.current[word.index] = el; }}
                      onClick={() => {
                        setCurrentWordIndex(word.index);
                        startReading(word.index);
                      }}
                      className={cn(
                        "inline-block mr-1.5 px-0.5 rounded transition-all cursor-pointer",
                        currentWordIndex === word.index 
                          ? "bg-orange-500 text-white scale-110 shadow-lg shadow-orange-500/20" 
                          : "hover:bg-white/10"
                      )}
                    >
                      {word.text}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 overflow-hidden relative">
            <AnimatePresence mode="wait">
              <motion.div 
                key={currentSlideIndex}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className={cn(
                  "w-full max-w-6xl h-[80vh] rounded-3xl flex flex-col md:flex-row shadow-2xl relative overflow-hidden transition-all duration-500",
                  isDarkMode ? "bg-[#1a1a1a] border border-white/10" : "bg-white border border-black/5"
                )}
              >
                {/* Main Slide Area */}
                <div className="flex-[3] flex flex-col p-8 md:p-12 overflow-hidden border-r border-white/5 relative">
                  {/* Toggle Notes Button (Floating) */}
                  <button 
                    onClick={() => {
                      stopReading();
                      setIsNotesVisible(!isNotesVisible);
                    }}
                    className={cn(
                      "absolute top-8 right-8 p-3 rounded-xl transition-all z-10 flex items-center gap-2 text-xs font-bold uppercase tracking-widest",
                      isNotesVisible 
                        ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" 
                        : "bg-white/5 hover:bg-white/10 text-orange-500 border border-orange-500/20"
                    )}
                  >
                    <Type size={16} />
                    {isNotesVisible ? "Hide Notes" : "Show Notes"}
                  </button>

                  <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar" ref={scrollRef}>
                    {structuredContent.filter(line => !line.words.some(w => w.text.startsWith('Notes:'))).map((line, lineIdx) => (
                      <div 
                        key={lineIdx} 
                        className={cn(
                          "mb-6 min-h-[1em]",
                          line.isHeader ? "text-4xl md:text-5xl font-black mb-10 text-orange-500 leading-tight" : "text-xl md:text-2xl opacity-90 leading-relaxed",
                          line.isEmpty ? "h-6" : ""
                        )}
                      >
                        {line.words.map((word) => (
                          <span
                            key={word.index}
                            ref={(el) => { wordRefs.current[word.index] = el; }}
                            onClick={() => {
                              setCurrentWordIndex(word.index);
                              startReading(word.index);
                            }}
                            className={cn(
                              "inline-block mr-2 px-1 rounded transition-all cursor-pointer",
                              currentWordIndex === word.index 
                                ? "bg-orange-500 text-white scale-105 shadow-lg shadow-orange-500/20" 
                                : "hover:bg-white/10"
                            )}
                          >
                            {word.text}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Slide Footer */}
                  <div className="mt-8 flex justify-between items-center pt-6 border-t border-white/10">
                    <div className="text-xs font-bold uppercase tracking-[0.2em] opacity-30">
                      {presentation?.title} • Slide {currentSlideIndex + 1}
                    </div>
                    <div className="flex gap-3">
                      <button 
                        disabled={currentSlideIndex === 0}
                        onClick={() => {
                          stopReading();
                          setCurrentSlideIndex(prev => prev - 1);
                        }}
                        className="p-3 bg-white/5 hover:bg-white/10 rounded-xl disabled:opacity-20 transition-all active:scale-90"
                      >
                        <ChevronLeft size={24} />
                      </button>
                      <button 
                        disabled={currentSlideIndex === (presentation?.slides.length || 0) - 1}
                        onClick={() => {
                          stopReading();
                          setCurrentSlideIndex(prev => prev + 1);
                        }}
                        className="p-3 bg-white/5 hover:bg-white/10 rounded-xl disabled:opacity-20 transition-all active:scale-90"
                      >
                        <ChevronRight size={24} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Study Notes Sidebar (Collapsable) */}
                <AnimatePresence>
                  {isNotesVisible && (
                    <motion.div 
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: "33.333%", opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      className={cn(
                        "p-8 flex flex-col gap-6 overflow-hidden border-l border-white/5",
                        isDarkMode ? "bg-white/5" : "bg-black/5"
                      )}
                    >
                      <div className="flex items-center gap-2 text-orange-500 shrink-0">
                        <Type size={18} />
                        <span className="text-xs font-bold uppercase tracking-widest">Study Notes</span>
                      </div>
                      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar italic text-lg opacity-80 leading-relaxed">
                        {structuredContent.filter(line => line.words.some(w => w.text.startsWith('Notes:'))).map((line, lineIdx) => (
                          <div key={lineIdx}>
                            {line.words.map((word) => (
                              <span
                                key={word.index}
                                ref={(el) => { wordRefs.current[word.index] = el; }}
                                onClick={() => {
                                  setCurrentWordIndex(word.index);
                                  startReading(word.index);
                                }}
                                className={cn(
                                  "inline-block mr-1.5 px-0.5 rounded transition-all cursor-pointer",
                                  currentWordIndex === word.index 
                                    ? "bg-orange-500 text-white scale-105" 
                                    : "hover:bg-white/10"
                                )}
                              >
                                {word.text}
                              </span>
                            ))}
                          </div>
                        ))}
                      </div>
                      <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-xs text-orange-500 font-medium shrink-0">
                        Notes are active. They will be read aloud after slide content.
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {/* Loading Overlay */}
        <AnimatePresence>
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
            >
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-orange-500 font-medium">Processing your content...</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Controls Bar */}
      {viewMode !== 'home' && (
        <footer className={cn(
          "p-6 border-t backdrop-blur-xl sticky bottom-0 z-40",
          isDarkMode ? "bg-black/80 border-white/10" : "bg-white/80 border-black/10"
        )}>
          <div className="max-w-5xl mx-auto flex flex-col gap-6">
            {/* Progress Bar */}
            <div className="relative w-full h-1.5 bg-white/10 rounded-full overflow-hidden group cursor-pointer">
              <div 
                className="absolute top-0 left-0 h-full bg-orange-500 transition-all duration-300"
                style={{ width: `${(currentWordIndex + 1) / words.length * 100}%` }}
              />
              <input 
                type="range" 
                min="0" 
                max={words.length - 1} 
                value={currentWordIndex}
                onChange={(e) => {
                  const idx = parseInt(e.target.value);
                  setCurrentWordIndex(idx);
                  startReading(idx);
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-6">
              {/* Left: Playback Controls */}
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => {
                    const next = Math.max(0, currentWordIndex - 10);
                    setCurrentWordIndex(next);
                    startReading(next);
                  }}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <Rewind size={20} />
                </button>
                
                <button 
                  onClick={togglePlayPause}
                  className="w-14 h-14 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-orange-500/30 transition-all active:scale-95"
                >
                  {isPlaying && !isPaused ? <Pause size={28} fill="white" /> : <Play size={28} fill="white" className="ml-1" />}
                </button>

                <button 
                  onClick={stopReading}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <Square size={20} fill={isDarkMode ? "white" : "black"} />
                </button>

                <button 
                  onClick={() => {
                    const next = Math.min(words.length - 1, currentWordIndex + 10);
                    setCurrentWordIndex(next);
                    startReading(next);
                  }}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <FastForward size={20} />
                </button>
              </div>

              {/* Center: Voice & Speed */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                  <Volume2 size={16} className="opacity-50" />
                  <select 
                    value={selectedVoice || ''} 
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="bg-transparent text-sm focus:outline-none max-w-[150px] truncate"
                  >
                    {voices.map(voice => (
                      <option key={voice.name} value={voice.name} className="bg-[#1a1a1a]">
                        {voice.name} ({voice.lang})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold opacity-50 uppercase tracking-widest">Speed</span>
                  <select 
                    value={playbackRate} 
                    onChange={(e) => {
                      const rate = parseFloat(e.target.value);
                      setPlaybackRate(rate);
                      if (isPlaying) startReading(currentWordIndex);
                    }}
                    className="bg-white/5 border border-white/10 rounded-full px-3 py-1 text-sm focus:outline-none"
                  >
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                      <option key={rate} value={rate} className="bg-[#1a1a1a]">{rate}x</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Right: Appearance */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Type size={16} className="opacity-50" />
                  <input 
                    type="range" 
                    min="12" 
                    max="48" 
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    className="w-24 accent-orange-500"
                  />
                </div>
                
                <button 
                  onClick={() => {
                    stopReading();
                    setContent('');
                    setPresentation(null);
                    setFileName(null);
                    setViewMode('home');
                  }}
                  className="text-xs font-bold uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
