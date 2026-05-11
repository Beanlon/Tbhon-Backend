-- Widen api_attempt — ML/debug URLs exceed VARCHAR(100) when multiple bases are tried.
ALTER TABLE `screening_sessions` MODIFY `api_attempt` TEXT NULL;

INSERT IGNORE INTO `symptom_questions` (`question_id`, `category`, `question_text`, `subtext`, `version`)
VALUES (
  'symptom_cough_3w',
  'symptom',
  'Have you had a cough that has lasted 2 weeks or longer?',
  'A persistent cough that does not go away is one of the most common signs of TB.',
  2
);
INSERT IGNORE INTO `symptom_questions` (`question_id`, `category`, `question_text`, `subtext`, `version`)
VALUES (
  'symptom_blood_sputum',
  'symptom',
  'Have you been coughing up blood or phlegm from deep in your lungs?',
  'This includes any blood-streaked mucus or sputum when you cough.',
  2
);
INSERT IGNORE INTO `symptom_questions` (`question_id`, `category`, `question_text`, `subtext`, `version`)
VALUES (
  'symptom_chest_pain',
  'symptom',
  'Are you experiencing chest pain when you breathe or cough?',
  NULL,
  2
);
INSERT IGNORE INTO `symptom_questions` (`question_id`, `category`, `question_text`, `subtext`, `version`)
VALUES (
  'symptom_fever',
  'symptom',
  'Have you had an unexplained fever recently?',
  'A fever that comes and goes without a clear cause.',
  2
);
INSERT IGNORE INTO `symptom_questions` (`question_id`, `category`, `question_text`, `subtext`, `version`)
VALUES (
  'symptom_night_sweats',
  'symptom',
  'Do you wake up at night drenched in sweat?',
  'Night sweats severe enough to soak your clothes or bedding.',
  2
);
INSERT IGNORE INTO `symptom_questions` (`question_id`, `category`, `question_text`, `subtext`, `version`)
VALUES (
  'symptom_weight_loss',
  'symptom',
  'Have you lost weight without trying?',
  'Unexplained weight loss over the past few weeks or months.',
  2
);
INSERT IGNORE INTO `symptom_questions` (`question_id`, `category`, `question_text`, `subtext`, `version`)
VALUES (
  'symptom_fatigue',
  'symptom',
  'Do you feel unusually weak or tired most of the time?',
  NULL,
  2
);
INSERT IGNORE INTO `symptom_questions` (`question_id`, `category`, `question_text`, `subtext`, `version`)
VALUES (
  'symptom_loss_appetite',
  'symptom',
  'Have you noticed a significant loss of appetite?',
  NULL,
  2
);
INSERT IGNORE INTO `symptom_questions` (`question_id`, `category`, `question_text`, `subtext`, `version`)
VALUES (
  'risk_contact_tb',
  'risk',
  'Have you been in close contact with someone who has or may have TB?',
  'This includes living with, caring for, or spending extended time with someone diagnosed with TB.',
  2
);
INSERT IGNORE INTO `symptom_questions` (`question_id`, `category`, `question_text`, `subtext`, `version`)
VALUES (
  'risk_high_burden_travel',
  'risk',
  'Were you born in, or have you recently traveled to, a country where TB is common?',
  'Such as parts of Asia, Africa, Eastern Europe, or Latin America.',
  2
);
INSERT IGNORE INTO `symptom_questions` (`question_id`, `category`, `question_text`, `subtext`, `version`)
VALUES (
  'risk_congregate_setting',
  'risk',
  'Do you live or work in a crowded or high-risk setting?',
  'Such as a shelter, prison, jail, nursing home, or hospital.',
  2
);
