import { supabase } from "@/integrations/supabase/client";

export interface DemoReference {
  title: string;
  authors: string;
  abstract: string;
  journal: string;
  year: number;
  doi?: string;
  pmid?: string;
  url?: string;
}

export const demoReferences: DemoReference[] = [
  {
    title: "Intracranial pressure monitoring in severe traumatic brain injury: results from the American College of Surgeons Trauma Quality Improvement Program",
    authors: "Farahvar A, Gerber LM, Chiu YL, Carney N, Härtl R, Ghajar J",
    abstract: "BACKGROUND: The role of intracranial pressure (ICP) monitoring in the management of severe traumatic brain injury (TBI) remains controversial. This study aimed to examine outcomes in patients with severe TBI who received ICP monitoring compared with those who did not. METHODS: We analyzed data from the American College of Surgeons Trauma Quality Improvement Program database from 2010 to 2012. Adult patients with severe TBI (Glasgow Coma Scale score ≤8) were included. Primary outcomes were in-hospital mortality and length of stay. Secondary outcomes included complications and discharge disposition. RESULTS: Of 6,417 patients with severe TBI, 2,134 (33.3%) received ICP monitoring. Patients who received ICP monitoring had lower mortality rates (18.2% vs 36.5%, p<0.001) and shorter length of stay (median 12 vs 8 days, p<0.001). After adjusting for confounding variables, ICP monitoring was associated with reduced mortality (OR 0.73, 95% CI 0.62-0.87, p<0.001). CONCLUSION: ICP monitoring in severe TBI patients was associated with improved survival and shorter hospital stays.",
    journal: "Journal of Trauma and Acute Care Surgery",
    year: 2012,
    doi: "10.1097/TA.0b013e318270d2fb",
    pmid: "23117378"
  },
  {
    title: "A trial of intracranial-pressure monitoring in traumatic brain injury",
    authors: "Chesnut RM, Temkin N, Carney N, Dikmen S, Rondina C, Videtta W, Petroni G, Lujan S, Pridgeon J, Barber J, Machamer J, Chaddock K, Celix JM, Cherner M, Hendrix T",
    abstract: "BACKGROUND: Current guidelines recommend intracranial-pressure (ICP) monitoring for severe traumatic brain injury, but efficacy has not been rigorously evaluated. METHODS: We randomly assigned 324 patients 13 years of age or older who had severe traumatic brain injury to care that included placement of an ICP monitor with treatment of intracranial hypertension or to care based on imaging and clinical examination. The primary outcome was a composite of survival time, impairment rating, and cognitive functioning at 6 months. Secondary outcomes included length of stay in the intensive care unit, number of days with brain-specific therapies, and 6-month neuropsychological outcome. RESULTS: The baseline characteristics of the two groups were similar. There was no significant difference between the ICP-monitoring group and the imaging-clinical examination group in the primary outcome (score on the Extended Glasgow Outcome Scale, 5.7 vs. 5.9; difference, −0.21; 95% confidence interval, −0.84 to 0.42; P=0.49). There were also no significant differences in mortality (39% vs. 41%, P=0.60), length of stay in the intensive care unit (12 vs. 9 days, P=0.25), or neuropsychological outcomes. CONCLUSIONS: Care focused on maintaining monitored ICP at 20 mm Hg or less was not shown to be superior to care based on imaging and clinical examination.",
    journal: "New England Journal of Medicine",
    year: 2012,
    doi: "10.1056/NEJMoa1207363",
    pmid: "23234472"
  },
  {
    title: "Effectiveness of intracranial pressure monitoring in reducing mortality in patients with traumatic brain injury: a systematic review and meta-analysis",
    authors: "Shen L, Wang Z, Su Z, Qiu S, Xu J, Zhou Y, Yan A",
    abstract: "OBJECTIVE: To evaluate the effectiveness of intracranial pressure (ICP) monitoring in reducing mortality in patients with traumatic brain injury (TBI) through systematic review and meta-analysis. METHODS: We searched PubMed, Embase, and Cochrane databases from inception to December 2015 for studies comparing outcomes between TBI patients with and without ICP monitoring. Primary outcome was mortality. Secondary outcomes included length of stay and functional outcomes. Random-effects models were used for meta-analysis. RESULTS: Fourteen studies involving 22,492 patients were included. ICP monitoring was associated with reduced mortality (RR 0.69, 95% CI 0.55-0.86, p=0.001). The benefit was more pronounced in severe TBI patients (RR 0.64, 95% CI 0.48-0.85, p=0.002). Length of ICU stay was longer in the ICP monitoring group (MD 3.2 days, 95% CI 1.8-4.6, p<0.001). Functional outcomes showed no significant difference. CONCLUSION: ICP monitoring is associated with reduced mortality in TBI patients, particularly those with severe injury.",
    journal: "Critical Care Medicine",
    year: 2016,
    doi: "10.1097/CCM.0000000000001982",
    pmid: "27618272"
  },
  {
    title: "Intracranial pressure monitoring in pediatric traumatic brain injury: a systematic review",
    authors: "Bennett TD, DeWitt PE, Greene TH, Srivastava R, Riva-Cambrin J, Nance ML, Bratton SL",
    abstract: "OBJECTIVE: To systematically review the literature on intracranial pressure (ICP) monitoring in pediatric traumatic brain injury (TBI) patients. METHODS: We conducted a systematic review of studies published from 1990 to 2014 examining ICP monitoring in pediatric TBI patients aged 0-18 years. We searched MEDLINE, Embase, and Cochrane databases. Studies were assessed for quality and outcomes including mortality, functional outcomes, and complications. RESULTS: Twenty-three studies met inclusion criteria, including 2,847 pediatric TBI patients. ICP monitoring was used in 45% of severe TBI cases. Studies showed conflicting results regarding mortality benefit, with some showing improved survival and others showing no difference. Complications related to ICP monitoring occurred in 2-5% of cases. Most studies had significant methodological limitations including selection bias and confounding by indication. CONCLUSION: The evidence for ICP monitoring in pediatric TBI remains limited and conflicting. High-quality randomized trials are needed to determine optimal management strategies.",
    journal: "Pediatric Critical Care Medicine",
    year: 2015,
    doi: "10.1097/PCC.0000000000000441",
    pmid: "25901468"
  },
  {
    title: "Economic evaluation of intracranial pressure monitoring in severe traumatic brain injury",
    authors: "Thompson HJ, Vavilala MS, Rivara FP, Bulger EM",
    abstract: "BACKGROUND: Economic evaluations of intracranial pressure (ICP) monitoring in traumatic brain injury (TBI) are limited. This study assessed the cost-effectiveness of ICP monitoring in severe TBI patients. METHODS: We conducted a decision analysis model comparing ICP monitoring versus standard care without monitoring in severe TBI patients. Outcomes included quality-adjusted life years (QALYs), costs, and incremental cost-effectiveness ratios (ICERs). Model inputs were derived from published literature and national databases. One-way and probabilistic sensitivity analyses were performed. RESULTS: ICP monitoring resulted in 0.85 additional QALYs per patient over lifetime compared to standard care. The incremental cost was $12,450 per patient, resulting in an ICER of $14,647 per QALY gained. Sensitivity analyses showed the results were robust across reasonable parameter ranges. At a willingness-to-pay threshold of $50,000 per QALY, ICP monitoring had a 78% probability of being cost-effective. CONCLUSION: ICP monitoring appears to be a cost-effective intervention for severe TBI patients.",
    journal: "Journal of Neurotrauma",
    year: 2014,
    doi: "10.1089/neu.2013.3136",
    pmid: "24160917"
  },
  {
    title: "Complications associated with intracranial pressure monitoring: a systematic review and meta-analysis",
    authors: "Tavakoli S, Peitz G, Ares W, Hafeez S, Grandhi R",
    abstract: "BACKGROUND: Intracranial pressure (ICP) monitoring is commonly used in traumatic brain injury management, but associated complications have not been systematically evaluated. This meta-analysis examined complications related to ICP monitoring devices. METHODS: We searched PubMed, Embase, and Cochrane databases for studies reporting complications of ICP monitoring in TBI patients. Primary outcomes were infection rates, hemorrhage, and device malfunction. Random-effects meta-analysis was performed. RESULTS: Forty-two studies involving 7,334 patients were included. The pooled infection rate was 8.2% (95% CI 6.1-10.9%). Hemorrhage occurred in 2.1% (95% CI 1.4-3.1%) of cases. Device malfunction was reported in 6.3% (95% CI 4.2-9.4%) of cases. External ventricular drains had higher infection rates compared to intraparenchymal monitors (11.4% vs 4.8%, p<0.001). Longer monitoring duration was associated with increased infection risk. CONCLUSION: ICP monitoring carries a significant risk of complications, particularly infection. Benefits must be weighed against potential risks.",
    journal: "Neurosurgery",
    year: 2017,
    doi: "10.1093/neuros/nyx100",
    pmid: "28379550"
  },
  {
    title: "Age-related differences in outcomes following intracranial pressure monitoring in traumatic brain injury",
    authors: "Morrison JF, Kerwin AJ, Ding Q, Boswell K, Torres M",
    abstract: "BACKGROUND: Age is an important prognostic factor in traumatic brain injury (TBI), but its interaction with intracranial pressure (ICP) monitoring effectiveness is unclear. This study examined age-related differences in outcomes following ICP monitoring. METHODS: Retrospective analysis of 1,247 severe TBI patients from a level 1 trauma center (2008-2013). Patients were stratified by age: young (<40 years), middle-aged (40-64 years), and elderly (≥65 years). Primary outcome was in-hospital mortality. Secondary outcomes included functional outcomes and length of stay. RESULTS: ICP monitoring was performed in 62% of patients. Mortality rates were 15%, 28%, and 45% in young, middle-aged, and elderly patients, respectively. ICP monitoring was associated with reduced mortality in young (OR 0.52, 95% CI 0.28-0.97) and middle-aged patients (OR 0.61, 95% CI 0.39-0.96) but not in elderly patients (OR 0.89, 95% CI 0.51-1.55). Functional outcomes at discharge were better in younger patients who received ICP monitoring. CONCLUSION: The benefit of ICP monitoring appears to diminish with advancing age.",
    journal: "Injury",
    year: 2018,
    doi: "10.1016/j.injury.2018.02.015",
    pmid: "29486965"
  },
  {
    title: "Non-invasive intracranial pressure monitoring techniques: a review of current methods and future directions",
    authors: "Khan MN, Shallwani H, Khan MU, Shamim MS",
    abstract: "BACKGROUND: Traditional intracranial pressure (ICP) monitoring requires invasive procedures that carry risks of complications. This review examines non-invasive methods for ICP assessment. METHODS: Comprehensive literature review of non-invasive ICP monitoring techniques including transcranial Doppler, optic nerve sheath diameter measurement, tympanic membrane displacement, and pupillometry. We evaluated accuracy, reliability, and clinical applicability of each method. RESULTS: Transcranial Doppler showed good correlation with invasive ICP measurements (r=0.70-0.85) but requires experienced operators. Optic nerve sheath diameter measurement is promising with correlation coefficients of 0.60-0.90 with invasive ICP. Tympanic membrane displacement and pupillometry show potential but require further validation. None of the non-invasive methods can completely replace invasive monitoring for precise ICP values and continuous monitoring. CONCLUSION: Non-invasive ICP monitoring techniques are evolving but currently cannot replace invasive monitoring in severe TBI management. They may be useful for screening and monitoring trends.",
    journal: "British Journal of Neurosurgery",
    year: 2017,
    doi: "10.1080/02688697.2017.1297364",
    pmid: "28285591"
  }
];

export const demoCriteria = {
  population: "Adult patients (≥18 years) with severe traumatic brain injury (Glasgow Coma Scale ≤8)",
  intervention: "Intracranial pressure monitoring using invasive devices (intraparenchymal monitors, external ventricular drains)",
  comparator: "Standard neurointensive care without ICP monitoring, alternative monitoring methods, or different ICP monitoring techniques",
  outcome: "Primary: Mortality, functional outcomes (Glasgow Outcome Scale). Secondary: Length of ICU stay, neurological recovery, complications",
  study_designs: ["Randomized Controlled Trial", "Systematic Review", "Cohort Study", "Case-Control Study"],
  timeframe_start: "2010",
  timeframe_end: "2024",
  timeframe_description: "Studies published from 2010 onwards to capture modern management practices",
  inclusion_criteria: [
    "Studies involving adult patients (≥18 years) with severe TBI",
    "Studies comparing ICP monitoring with control groups",
    "Studies reporting mortality or functional outcomes",
    "English language publications",
    "Peer-reviewed journal articles"
  ],
  exclusion_criteria: [
    "Pediatric studies (patients <18 years) unless specifically addressing transition to adult care",
    "Studies focusing solely on technical aspects of monitoring devices",
    "Case reports or case series with <10 patients",
    "Studies not reporting relevant clinical outcomes",
    "Non-English publications",
    "Conference abstracts without full-text articles"
  ]
};

export const loadDemoData = async () => {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error("Please sign in to load demo data");
    }

    // Create demo project
    const { data: project, error: projectError } = await supabase
      .from('review_projects')
      .insert({
        name: "ICP Monitoring in Traumatic Brain Injury - Demo",
        description: "Systematic review examining the effectiveness of intracranial pressure monitoring in adult patients with severe traumatic brain injury",
        population: demoCriteria.population,
        intervention: demoCriteria.intervention,
        comparator: demoCriteria.comparator,
        outcome: demoCriteria.outcome,
        study_designs: demoCriteria.study_designs,
        timeframe_start: demoCriteria.timeframe_start,
        timeframe_end: demoCriteria.timeframe_end,
        timeframe_description: demoCriteria.timeframe_description,
        status: 'criteria_defined',
        user_id: user.id
      })
      .select()
      .single();

    if (projectError) {
      throw projectError;
    }

    // Create screening criteria
    const { error: criteriaError } = await supabase
      .from('screening_criteria')
      .insert({
        project_id: project.id,
        population: demoCriteria.population,
        intervention: demoCriteria.intervention,
        comparator: demoCriteria.comparator,
        outcome: demoCriteria.outcome,
        study_designs: demoCriteria.study_designs,
        timeframe_start: demoCriteria.timeframe_start,
        timeframe_end: demoCriteria.timeframe_end,
        timeframe_description: demoCriteria.timeframe_description,
        inclusion_criteria: demoCriteria.inclusion_criteria,
        exclusion_criteria: demoCriteria.exclusion_criteria
      });

    if (criteriaError) {
      throw criteriaError;
    }

    // Insert demo references
    const referencesToInsert = demoReferences.map(ref => ({
      project_id: project.id,
      user_id: user.id,
      title: ref.title,
      authors: ref.authors,
      abstract: ref.abstract,
      journal: ref.journal,
      year: ref.year,
      doi: ref.doi,
      pmid: ref.pmid,
      url: ref.url,
      status: 'pending'
    }));

    const { error: referencesError } = await supabase
      .from('references')
      .insert(referencesToInsert);

    if (referencesError) {
      throw referencesError;
    }

    // Update project reference count
    const { error: updateError } = await supabase
      .from('review_projects')
      .update({ total_references: demoReferences.length })
      .eq('id', project.id);

    if (updateError) {
      throw updateError;
    }

    return {
      project,
      referencesCount: demoReferences.length
    };

  } catch (error) {
    console.error('Error loading demo data:', error);
    throw error;
  }
};