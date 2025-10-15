import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Calculator, TrendingUp, PieChart, BarChart3, Info, Recycle, Wallet, Target } from 'lucide-react';
import fundoraLogo from '@/assets/fundora-logo-official.png';

interface SimulationData {
  souscription: number;
  nombreAnnees: number;
  multipleBaseCible: number;
  tauxReinvestissement: number;
  investmentType: 'BUYOUT' | 'VENTURE_CAPITAL' | 'SECONDARY' | 'GROWTH_CAPITAL' | 'DEBT';
  moicCible: number;
  rendementCible: number; // Pour la dette (en %)
  profilInvestisseur: 'PERSONNE_PHYSIQUE' | 'PERSONNE_MORALE';
  reinvestirDistributions: boolean;
  typeReinvestissement: 'BUYOUT' | 'VENTURE_CAPITAL' | 'GROWTH_CAPITAL' | 'SECONDARY';
  dureeVieFonds: number; // Durée de vie totale du fonds
  capitalCallsParAnnee: number[]; // Capital calls par année en % de la souscription
  distributionsParAnnee: number[]; // Distributions par année en % de la souscription
}

interface YearlyData {
  annee: number;
  capitalCall: number;
  distribution: number;
  coupon?: number; // Pour séparer les coupons dans la dette
  capitalRendu?: number; // Pour séparer le capital rendu dans la dette
  distributionRecyclee: number;
  montantRealDecaisse: number;
  fluxNet: number;
  valeurFuture: number;
}

export default function InvestmentSimulator() {
  const [data, setData] = useState<SimulationData>({
    souscription: 100000,
    nombreAnnees: 5,
    multipleBaseCible: 2.5,
    tauxReinvestissement: 0.15,
    investmentType: 'BUYOUT',
    moicCible: 2.5,
    rendementCible: 11, // 11% pour la dette
    profilInvestisseur: 'PERSONNE_PHYSIQUE',
    reinvestirDistributions: false,
    typeReinvestissement: 'BUYOUT',
    dureeVieFonds: 10, // Durée de vie du fonds par défaut
    capitalCallsParAnnee: Array(10).fill(0), // 10 années par défaut
    distributionsParAnnee: Array(10).fill(0) // 10 années par défaut
  });

  const [results, setResults] = useState<YearlyData[]>([]);
  const [finalResults, setFinalResults] = useState({
    capitalTotalRealInvesti: 0,
    capitalRealInvesti: 0,
    valeurFinaleReinvestie: 0,
    moic: 0,
    triAnnuelSansReinvest: 0,
    fraisTotaux: 0,
    impotsTotaux: 0,
    totalNetPercu: 0,
    interetsObligataires: 0
  });

  const [resultsAvecReinvestissement, setResultsAvecReinvestissement] = useState({
    valeurFinale: 0,
    moic: 0,
    triAnnuel: 0,
    impotsTotaux: 0,
    totalNetPercu: 0
  });

    const calculateSimulation = () => {
    // Calcul des frais de plateforme selon les tranches
    const calculatePlatformFees = (montant: number, annee: number) => {
      if (montant < 30000) {
        // 0 à 29,999€ : 1,7% tous les ans + 3% première année seulement
        const fraisAnnuels = montant * 0.017;
        const fraisPremièreAnnée = annee === 1 ? montant * 0.03 : 0;
        return fraisAnnuels + fraisPremièreAnnée;
      } else if (montant < 100000) {
        // 30,000 à 99,999€ : 1,5% tous les ans + 2,5% première année seulement
        const fraisAnnuels = montant * 0.015;
        const fraisPremièreAnnée = annee === 1 ? montant * 0.025 : 0;
        return fraisAnnuels + fraisPremièreAnnée;
      } else {
        // 100,000€ et plus : 1,2% tous les ans + 2% première année seulement
        const fraisAnnuels = montant * 0.012;
        const fraisPremièreAnnée = annee === 1 ? montant * 0.02 : 0;
        return fraisAnnuels + fraisPremièreAnnée;
      }
    };

    // Calcul des frais totaux (seront déduits à la fin)
    let fraisTotaux = 0;
    for (let i = 1; i <= data.dureeVieFonds; i++) {
      fraisTotaux += calculatePlatformFees(data.souscription, i);
    }
    const montantNetInvesti = data.souscription; // Tout est investi, frais déduits à la fin

    // Pour les tickets < 30k : calcul des intérêts obligataires à 2% sur le capital non appelé
    const isSmallTicket = data.souscription < 30000;
    const tauxObligataire = 0.02; // 2% par an

    // Les capital calls et distributions sont saisis en pourcentage, on les convertit en montants
    const capitalCallsUtilises = data.capitalCallsParAnnee.slice(0, data.dureeVieFonds).map(pct => (pct / 100) * data.souscription);
    const distributionsUtilisees = data.distributionsParAnnee.slice(0, data.dureeVieFonds).map(pct => (pct / 100) * data.souscription);

    // Pour les tickets < 30k : calculer le capital total appelé selon les valeurs saisies
    let capitalAppelNormal: number[] = []; // Pour chaque année, le capital appelé cumulé normalement
    
    if (isSmallTicket) {
      let cumulCapitalAppele = 0;
      for (let i = 1; i <= data.dureeVieFonds; i++) {
        const capitalCallAnnuel = capitalCallsUtilises[i - 1] || 0;
        cumulCapitalAppele += capitalCallAnnuel;
        capitalAppelNormal.push(cumulCapitalAppele);
      }
    }

    // Première passe : calculer le capital réel décaissé sans distributions
    const firstPassYears: YearlyData[] = [];
    let totalActualCashOutEstimate = 0;
    
    for (let i = 1; i <= data.dureeVieFonds; i++) {
      const year: YearlyData = {
        annee: i,
        capitalCall: 0,
        distribution: 0,
        distributionRecyclee: 0,
        montantRealDecaisse: 0,
        fluxNet: 0,
        valeurFuture: 0
      };

      // Capital call - Pour les montants < 30k, tout versé en année 1 dans le SPV
      if (isSmallTicket) {
        if (i === 1) {
          year.capitalCall = -montantNetInvesti;
        }
        // Mais on va comptabiliser les intérêts obligataires sur le capital non encore appelé
      } else {
        // Utiliser les valeurs saisies manuellement
        const capitalCallSaisi = capitalCallsUtilises[i - 1] || 0;
        year.capitalCall = capitalCallSaisi > 0 ? -capitalCallSaisi : 0;
      }

      // Pas de distributions dans cette passe d'estimation
      year.distribution = 0;
      year.distributionRecyclee = 0;
      year.montantRealDecaisse = year.capitalCall;
      
      totalActualCashOutEstimate += Math.abs(year.montantRealDecaisse);
      firstPassYears.push(year);
    }

    // Les distributions sont maintenant saisies manuellement, pas besoin de calculer valeurTotaleDistributions

    // Deuxième passe : calcul final avec les vraies distributions linéaires
    const years: YearlyData[] = [];
    let totalCapitalCalled = 0;
    let totalActualCashOut = 0;
    let interetsObligatairesTotaux = 0; // Pour les tickets < 30k

    for (let i = 1; i <= data.dureeVieFonds; i++) {
      const year: YearlyData = {
        annee: i,
        capitalCall: 0,
        distribution: 0,
        distributionRecyclee: 0,
        montantRealDecaisse: 0,
        fluxNet: 0,
        valeurFuture: 0
      };

      // Capital call - Pour les montants < 30k, tout versé en année 1 dans le SPV
      if (isSmallTicket) {
        if (i === 1) {
          year.capitalCall = -montantNetInvesti;
        }
        
        // Calculer les intérêts obligataires sur le capital non encore appelé par le fonds
        // Le capital non appelé = montant total - capital appelé normalement jusqu'à cette année
        const capitalNonAppele = montantNetInvesti - (capitalAppelNormal[i-1] || 0);
        if (capitalNonAppele > 0) {
          const interetsAnnee = capitalNonAppele * tauxObligataire;
          interetsObligatairesTotaux += interetsAnnee;
          // Ces intérêts sont capitalisés et seront consommés en priorité lors des appels
        }
      } else {
        // Utiliser les valeurs saisies manuellement
        const capitalCallSaisi = capitalCallsUtilises[i - 1] || 0;
        year.capitalCall = capitalCallSaisi > 0 ? -capitalCallSaisi : 0;
      }

      // Distributions - utiliser les valeurs saisies manuellement
      const distributionSaisie = distributionsUtilisees[i - 1] || 0;
      year.distribution = distributionSaisie;

      // Calcul du recyclage - seulement si capital call ET distribution la même année
      const capitalDejaAppele = years.reduce((sum, prevYear) => {
        return sum + Math.abs(prevYear.capitalCall) + prevYear.distributionRecyclee;
      }, 0);
      
      const commitmentRestant = Math.max(0, data.souscription - capitalDejaAppele);

      // Pour la dette, pas de recyclage car c'est des coupons + remboursement
      if (data.investmentType === 'DEBT') {
        year.distributionRecyclee = 0;
      } else {
        // Recyclage uniquement quand capital call ET distribution la même année
        if (year.distribution > 0 && year.capitalCall < 0) {
          const capitalCallCetteAnnee = Math.abs(year.capitalCall);
          const recyclageNecessaire = Math.min(year.distribution, capitalCallCetteAnnee);
          year.distributionRecyclee = recyclageNecessaire;
        } else {
          year.distributionRecyclee = 0; // Pas de recyclage si pas de capital call
        }
      }

      // Cash décaissé = capital call + distribution recyclée (mais 0 si pas de capital call)
      // Les frais sont déjà déduits du montant investi au début
      year.montantRealDecaisse = year.capitalCall < 0 ? year.capitalCall + year.distributionRecyclee : 0;
      year.fluxNet = year.distribution - year.distributionRecyclee + year.capitalCall;

      const distributionNette = year.distribution - year.distributionRecyclee;
      if (distributionNette > 0) {
        let anneesRestantes: number;
        if (data.investmentType === 'SECONDARY') {
          // Pour le secondaire, valeur future calculée à T6
          anneesRestantes = Math.max(0, 6 - i);
        } else if (data.investmentType === 'DEBT') {
          // Pour la dette, valeur future calculée à T7 (7 ans de durée de fonds)
          anneesRestantes = Math.max(0, 7 - i);
        } else {
          // Pour les autres types, valeur future calculée à la durée de vie du fonds
          anneesRestantes = Math.max(0, data.dureeVieFonds - i);
        }
        year.valeurFuture = distributionNette * Math.pow(1 + data.tauxReinvestissement, anneesRestantes);
      }

      totalCapitalCalled += Math.abs(year.capitalCall);
      totalActualCashOut += Math.abs(year.montantRealDecaisse);
      years.push(year);
    }

    // Calcul du TRI avec formule fixe : TRI = (Valeur finale / Capital réel investi)^(1/durée) - 1
    const calculateTRI = (valeurFinale: number, capitalReel: number, duree: number): number => {
      if (capitalReel <= 0 || duree <= 0) return 0;
      return Math.pow(valeurFinale / capitalReel, 1 / duree) - 1;
    };
    
    // Calcul des résultats finaux
    // La valeur finale = souscription * MOIC cible
    const valeurFinaleReinvestie = data.souscription * data.moicCible;
    const moic = data.moicCible;
    const triAnnuelSansReinvest = calculateTRI(valeurFinaleReinvestie, totalActualCashOut, data.dureeVieFonds);

    // Calcul des impôts - flat tax 30% sur la plus-value uniquement pour personne physique
    let impotsTotaux = 0;
    let totalNetPercu = 0;
    
    if (data.profilInvestisseur === 'PERSONNE_PHYSIQUE') {
      // La flat tax = (total redistributions - souscription) * 0.30
      const totalDistributions = valeurFinaleReinvestie;
      impotsTotaux = Math.max(0, totalDistributions - data.souscription) * 0.30;
      // Total net perçu = Total redistributions - Impôts
      totalNetPercu = totalDistributions - impotsTotaux;
    } else {
      // Personne morale - IS non calculé
      totalNetPercu = valeurFinaleReinvestie;
    }

    setResults(years);
    setFinalResults({
      capitalTotalRealInvesti: totalCapitalCalled,
      capitalRealInvesti: totalActualCashOut,
      valeurFinaleReinvestie,
      moic,
      triAnnuelSansReinvest,
      fraisTotaux,
      impotsTotaux,
      totalNetPercu,
      interetsObligataires: interetsObligatairesTotaux // Ajouter pour affichage
    });

    // Calcul avec réinvestissement si activé
    if (data.reinvestirDistributions) {
      // Calculer la somme des plus-values de réinvestissement
      let sommePlusValues = 0;
      
      // TRI selon le type de réinvestissement
      const triReinvest = data.typeReinvestissement === 'VENTURE_CAPITAL' ? 0.15 : 
                          data.typeReinvestissement === 'GROWTH_CAPITAL' ? 0.133 :
                          data.typeReinvestissement === 'SECONDARY' ? 0.082 : 0.096;
      
      // Calculer la plus-value pour chaque distribution réinvestie
      years.forEach(year => {
        const distributionNette = year.distribution - year.distributionRecyclee;
        if (distributionNette > 0) {
          // Nombre d'années jusqu'à la fin du fonds de base (dureeVieFonds)
          const anneesRestantes = data.dureeVieFonds - year.annee;
          
          // Valeur future = Valeur initiale × (1 + TRI)^durée
          const valeurFuture = distributionNette * Math.pow(1 + triReinvest, Math.max(0, anneesRestantes));
          
          // Plus-value = Valeur réinvestie - Distribution nette
          const plusValue = valeurFuture - distributionNette;
          sommePlusValues += plusValue;
        }
      });
      
      // Calcul impôts avec réinvestissement
      let impotsTotauxReinvest = 0;
      let valeurFinaleAvecReinvest = 0;
      let totalNetPercuReinvest = 0;
      
      if (data.profilInvestisseur === 'PERSONNE_PHYSIQUE') {
        // Impôts sur les plus-values du réinvestissement
        const impotsPlusValues = sommePlusValues * 0.30;
        
        // Impôts totaux = Impôts sans réinvestissement + Impôts sur plus-values
        impotsTotauxReinvest = impotsTotaux + impotsPlusValues;
        
        // Valeur finale = Total net perçu sans réinvestissement + Plus-values brutes
        valeurFinaleAvecReinvest = totalNetPercu + sommePlusValues;
        
        // Total net perçu = Valeur finale - Flat tax sur les réinvestissements
        totalNetPercuReinvest = valeurFinaleAvecReinvest - impotsPlusValues;
      } else {
        // Personne morale - Valeur finale = Total net perçu sans réinvestissement + Somme des plus-values
        valeurFinaleAvecReinvest = totalNetPercu + sommePlusValues;
        totalNetPercuReinvest = valeurFinaleAvecReinvest;
      }
      
      const moicAvecReinvest = valeurFinaleAvecReinvest / totalActualCashOut;
      
      // Calcul du TRI avec réinvestissement en utilisant la formule fixe
      const triAvecReinvest = calculateTRI(valeurFinaleAvecReinvest, totalActualCashOut, data.dureeVieFonds);
      
      setResultsAvecReinvestissement({
        valeurFinale: valeurFinaleAvecReinvest,
        moic: moicAvecReinvest,
        triAnnuel: triAvecReinvest,
        impotsTotaux: impotsTotauxReinvest,
        totalNetPercu: totalNetPercuReinvest
      });
    }
  };

  useEffect(() => {
    calculateSimulation();
  }, [data]);

  const handleInputChange = (field: keyof SimulationData, value: number | string | boolean) => {
    setData(prev => {
      const newData = {
        ...prev,
        [field]: value
      };
      
      // Si la souscription change et est < 30 000€, mettre automatiquement 100% en année 1
      if (field === 'souscription' && typeof value === 'number' && value < 30000) {
        const newCapitalCalls = [...prev.capitalCallsParAnnee];
        newCapitalCalls[0] = 100; // 100% en première année
        // Mettre les autres années à 0
        for (let i = 1; i < newCapitalCalls.length; i++) {
          newCapitalCalls[i] = 0;
        }
        newData.capitalCallsParAnnee = newCapitalCalls;
      }
      
      return newData;
    });
  };

  const handleInvestmentTypeChange = (type: 'BUYOUT' | 'VENTURE_CAPITAL' | 'SECONDARY' | 'GROWTH_CAPITAL' | 'DEBT') => {
    // Définir les MOIC par défaut selon le type d'investissement
    let defaultMoic = 2.5;
    let defaultRendement = 11;
    
    switch(type) {
      case 'VENTURE_CAPITAL':
        defaultMoic = 4;
        break;
      case 'GROWTH_CAPITAL':
        defaultMoic = 3.5;
        break;
      case 'SECONDARY':
        defaultMoic = 2.2;
        break;
      case 'BUYOUT':
        defaultMoic = 2.5;
        break;
      case 'DEBT':
        defaultRendement = 11;
        break;
      default:
        defaultMoic = 2.5;
    }
    
    setData(prev => ({
      ...prev,
      investmentType: type,
      moicCible: defaultMoic,
      rendementCible: defaultRendement
    }));
  };

  const handleCapitalCallChange = (annee: number, valeur: number) => {
    const newCapitalCalls = [...data.capitalCallsParAnnee];
    newCapitalCalls[annee] = valeur;
    setData(prev => ({ ...prev, capitalCallsParAnnee: newCapitalCalls }));
  };

  const handleDistributionChange = (annee: number, valeur: number) => {
    const newDistributions = [...data.distributionsParAnnee];
    newDistributions[annee] = valeur;
    setData(prev => ({ ...prev, distributionsParAnnee: newDistributions }));
  };

  const handleDureeVieFondsChange = (nouvelleDuree: number) => {
    const newCapitalCalls = Array(nouvelleDuree).fill(0).map((_, i) => data.capitalCallsParAnnee[i] || 0);
    const newDistributions = Array(nouvelleDuree).fill(0).map((_, i) => data.distributionsParAnnee[i] || 0);
    setData(prev => ({
      ...prev,
      dureeVieFonds: nouvelleDuree,
      capitalCallsParAnnee: newCapitalCalls,
      distributionsParAnnee: newDistributions
    }));
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-background">
        <div className="main-container container mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-fit">
            {/* Formulaire - Colonne de gauche */}
            <div className="space-y-6 h-fit">
              <div className="box h-fit">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="souscription">Souscription (€)</Label>
                    <Input
                      id="souscription"
                      type="number"
                      value={data.souscription}
                      onChange={(e) => handleInputChange('souscription', Number(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Type d'investissement</Label>
                    <div className="flex flex-wrap gap-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="buyout"
                          name="investment-type"
                          value="BUYOUT"
                          checked={data.investmentType === 'BUYOUT'}
                          onChange={() => handleInvestmentTypeChange('BUYOUT')}
                          className="w-4 h-4 text-primary border-border focus:ring-primary"
                        />
                        <Label htmlFor="buyout" className="text-sm">Buyout</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="vc"
                          name="investment-type"
                          value="VENTURE_CAPITAL"
                          checked={data.investmentType === 'VENTURE_CAPITAL'}
                          onChange={() => handleInvestmentTypeChange('VENTURE_CAPITAL')}
                          className="w-4 h-4 text-primary border-border focus:ring-primary"
                        />
                        <Label htmlFor="vc" className="text-sm">Venture Capital</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="growth"
                          name="investment-type"
                          value="GROWTH_CAPITAL"
                          checked={data.investmentType === 'GROWTH_CAPITAL'}
                          onChange={() => handleInvestmentTypeChange('GROWTH_CAPITAL')}
                          className="w-4 h-4 text-primary border-border focus:ring-primary"
                        />
                        <Label htmlFor="growth" className="text-sm">Growth Capital</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="secondary"
                          name="investment-type"
                          value="SECONDARY"
                          checked={data.investmentType === 'SECONDARY'}
                          onChange={() => handleInvestmentTypeChange('SECONDARY')}
                          className="w-4 h-4 text-primary border-border focus:ring-primary"
                        />
                        <Label htmlFor="secondary" className="text-sm">Secondaire</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="debt"
                          name="investment-type"
                          value="DEBT"
                          checked={data.investmentType === 'DEBT'}
                          onChange={() => handleInvestmentTypeChange('DEBT')}
                          className="w-4 h-4 text-primary border-border focus:ring-primary"
                        />
                        <Label htmlFor="debt" className="text-sm">Debt</Label>
                      </div>
                    </div>
                  </div>

                  {data.investmentType === 'DEBT' ? (
                    <div className="space-y-2">
                      <Label htmlFor="rendementCible">Rendement Cible (%)</Label>
                      <Input
                        id="rendementCible"
                        type="number"
                        step="0.1"
                        min="0"
                        value={data.rendementCible}
                        onChange={(e) => handleInputChange('rendementCible', Number(e.target.value))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Rendement annuel en % (ex: 11 pour 11% par an)
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="moicCible">MOIC Cible</Label>
                      <Input
                        id="moicCible"
                        type="number"
                        step="0.1"
                        min="1"
                        value={data.moicCible}
                        onChange={(e) => handleInputChange('moicCible', Number(e.target.value))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Multiple sur le capital investi (ex: 2.5 = +150% de retour)
                      </p>
                    </div>
                  )}

                  <div className="space-y-2 border-t pt-4">
                    <Label htmlFor="dureeVieFonds">Durée de vie du fonds (années)</Label>
                    <Input
                      id="dureeVieFonds"
                      type="number"
                      min="1"
                      max="20"
                      value={data.dureeVieFonds}
                      onChange={(e) => handleDureeVieFondsChange(Number(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Durée totale du fonds
                    </p>
                  </div>

                  <div className="space-y-2 border-t pt-4">
                    <Label>Capital Calls par année (%)</Label>
                    <p className="text-xs text-muted-foreground">
                      Pourcentage de la souscription ({data.souscription.toLocaleString('fr-FR')}€)
                    </p>
                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                      {Array.from({ length: data.dureeVieFonds }).map((_, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Label className="text-xs w-16">Année {index + 1}</Label>
                          <div className="flex items-center gap-1 flex-1">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={data.capitalCallsParAnnee[index] || 0}
                              onChange={(e) => handleCapitalCallChange(index, Number(e.target.value))}
                              className="text-sm"
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 border-t pt-4">
                    <Label>Distributions par année (%)</Label>
                    <p className="text-xs text-muted-foreground">
                      Pourcentage de la souscription ({data.souscription.toLocaleString('fr-FR')}€)
                    </p>
                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                      {Array.from({ length: data.dureeVieFonds }).map((_, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Label className="text-xs w-16">Année {index + 1}</Label>
                          <div className="flex items-center gap-1 flex-1">
                            <Input
                              type="number"
                              min="0"
                              step="0.1"
                              value={data.distributionsParAnnee[index] || 0}
                              onChange={(e) => handleDistributionChange(index, Number(e.target.value))}
                              className="text-sm"
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 border-t pt-4">
                    <Label>Profil investisseur</Label>
                    <div className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="personne-physique"
                          name="profil-investisseur"
                          value="PERSONNE_PHYSIQUE"
                          checked={data.profilInvestisseur === 'PERSONNE_PHYSIQUE'}
                          onChange={() => handleInputChange('profilInvestisseur', 'PERSONNE_PHYSIQUE')}
                          className="w-4 h-4 text-primary border-border focus:ring-primary"
                        />
                        <Label htmlFor="personne-physique" className="text-sm">Personne physique</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="personne-morale"
                          name="profil-investisseur"
                          value="PERSONNE_MORALE"
                          checked={data.profilInvestisseur === 'PERSONNE_MORALE'}
                          onChange={() => handleInputChange('profilInvestisseur', 'PERSONNE_MORALE')}
                          className="w-4 h-4 text-primary border-border focus:ring-primary"
                        />
                        <Label htmlFor="personne-morale" className="text-sm">Personne morale</Label>
                      </div>
                    </div>
                    {data.profilInvestisseur === 'PERSONNE_PHYSIQUE' && (
                      <p className="text-xs text-muted-foreground">
                        Flat tax 30% appliquée sur la plus-value uniquement
                      </p>
                    )}
                    {data.profilInvestisseur === 'PERSONNE_MORALE' && (
                      <p className="text-xs text-amber-500">
                        IS non calculé pour le moment
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="reinvestir">Réinvestir les distributions</Label>
                      <input
                        type="checkbox"
                        id="reinvestir"
                        checked={data.reinvestirDistributions}
                        onChange={(e) => handleInputChange('reinvestirDistributions', e.target.checked)}
                        className="w-4 h-4 text-primary border-border focus:ring-primary rounded"
                      />
                    </div>
                    {data.reinvestirDistributions && (
                      <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                        <p className="text-xs text-muted-foreground">
                          Les distributions seront réinvesties jusqu'à la fin de vie du fonds ({data.dureeVieFonds} ans)
                        </p>
                        
                        <div className="space-y-2">
                          <Label className="text-sm">Type de réinvestissement</Label>
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center space-x-2">
                              <input
                                type="radio"
                                id="reinvest-buyout"
                                name="type-reinvestissement"
                                value="BUYOUT"
                                checked={data.typeReinvestissement === 'BUYOUT'}
                                onChange={() => handleInputChange('typeReinvestissement', 'BUYOUT')}
                                className="w-4 h-4 text-primary border-border focus:ring-primary"
                              />
                              <Label htmlFor="reinvest-buyout" className="text-sm">LBO (2.5x)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="radio"
                                id="reinvest-vc"
                                name="type-reinvestissement"
                                value="VENTURE_CAPITAL"
                                checked={data.typeReinvestissement === 'VENTURE_CAPITAL'}
                                onChange={() => handleInputChange('typeReinvestissement', 'VENTURE_CAPITAL')}
                                className="w-4 h-4 text-primary border-border focus:ring-primary"
                              />
                              <Label htmlFor="reinvest-vc" className="text-sm">VC (4x)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="radio"
                                id="reinvest-growth"
                                name="type-reinvestissement"
                                value="GROWTH_CAPITAL"
                                checked={data.typeReinvestissement === 'GROWTH_CAPITAL'}
                                onChange={() => handleInputChange('typeReinvestissement', 'GROWTH_CAPITAL')}
                                className="w-4 h-4 text-primary border-border focus:ring-primary"
                              />
                              <Label htmlFor="reinvest-growth" className="text-sm">Growth (3.5x)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="radio"
                                id="reinvest-secondary"
                                name="type-reinvestissement"
                                value="SECONDARY"
                                checked={data.typeReinvestissement === 'SECONDARY'}
                                onChange={() => handleInputChange('typeReinvestissement', 'SECONDARY')}
                                className="w-4 h-4 text-primary border-border focus:ring-primary"
                              />
                              <Label htmlFor="reinvest-secondary" className="text-sm">Secondaire (2.2x)</Label>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Résultats - Colonne de droite */}
            <div className="space-y-6 h-fit">
              {!data.reinvestirDistributions ? (
                /* Scénario sans réinvestissement */
                <div className="box">
                  <h3 className="text-lg font-semibold mb-4">Résultats</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="box relative">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help absolute top-2 right-2" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Montant réellement décaissé de votre poche. Grâce au recyclage des distributions, ce montant est inférieur à votre souscription initiale car une partie des distributions retournent dans le fonds.</p>
                        </TooltipContent>
                      </Tooltip>
                      <div className="big-number text-xl font-bold">
                        {Math.round(finalResults.capitalRealInvesti).toLocaleString('fr-FR')} €
                      </div>
                      <p className="text text-sm mt-1">Capital réel investi</p>
                    </div>

                    <div className="box relative">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help absolute top-2 right-2" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Valeur totale de votre investissement à la fin de la période, incluant le réinvestissement des distributions nettes au taux de 15% annuel, après déduction des frais totaux.</p>
                        </TooltipContent>
                      </Tooltip>
                      <div className="big-number text-xl font-bold">
                        {Math.round(finalResults.valeurFinaleReinvestie).toLocaleString('fr-FR')} €
                      </div>
                      <p className="text text-sm mt-1">Valeur finale</p>
                    </div>

                    <div className="box relative">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help absolute top-2 right-2" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Frais totaux de la plateforme sur 10 ans, déduits de la valeur finale. Comprend les frais d'entrée et les frais annuels de gestion.</p>
                        </TooltipContent>
                      </Tooltip>
                      <div className="big-number text-xl font-bold text-destructive">
                        -{Math.round(finalResults.fraisTotaux).toLocaleString('fr-FR')} €
                      </div>
                      <p className="text text-sm mt-1">Frais totaux</p>
                    </div>

                    {data.souscription < 30000 && finalResults.interetsObligataires > 0 && (
                      <div className="box relative">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help absolute top-2 right-2" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Intérêts générés à 2%/an sur le capital placé en support obligataire dans le SPV, en attendant les appels de fonds. Ces intérêts sont capitalisés et consommés en priorité lors des appels.</p>
                          </TooltipContent>
                        </Tooltip>
                        <div className="big-number text-xl font-bold text-green-500">
                          +{Math.round(finalResults.interetsObligataires).toLocaleString('fr-FR')} €
                        </div>
                        <p className="text text-sm mt-1">Intérêts obligataires (2%)</p>
                      </div>
                    )}

                    <div className="box relative">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help absolute top-2 right-2" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Total Value to Paid-In capital : ratio entre la valeur finale et le capital réel investi. Correspond au MOIC cible de la stratégie choisie.</p>
                        </TooltipContent>
                      </Tooltip>
                      <div className="big-number text-xl font-bold">
                        {Math.round(data.moicCible * 100) / 100}x
                      </div>
                      <p className="text text-sm mt-1">TVPI</p>
                    </div>

                    <div className="box relative">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help absolute top-2 right-2" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Taux de Rendement Interne annualisé sans réinvestissement des distributions, tenant compte du recyclage uniquement.</p>
                        </TooltipContent>
                      </Tooltip>
                      <div className="big-number text-xl font-bold">
                        {(finalResults.triAnnuelSansReinvest * 100).toFixed(2)}%
                      </div>
                      <p className="text text-sm mt-1">TRI Annuel</p>
                    </div>

                    <div className="box relative">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help absolute top-2 right-2" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>
                            {data.profilInvestisseur === 'PERSONNE_PHYSIQUE' 
                              ? 'Impôts calculés avec flat tax 30% sur la plus-value uniquement' 
                              : 'IS non calculé pour le moment'}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                      <div className="big-number text-xl font-bold text-amber-500">
                        {data.profilInvestisseur === 'PERSONNE_PHYSIQUE' 
                          ? `-${Math.round(finalResults.impotsTotaux).toLocaleString('fr-FR')} €`
                          : 'N/A'}
                      </div>
                      <p className="text text-sm mt-1">Impôts</p>
                    </div>

                    <div className="box relative">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help absolute top-2 right-2" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Total net perçu après impôts et frais</p>
                        </TooltipContent>
                      </Tooltip>
                      <div className="big-number text-xl font-bold text-green-500">
                        {Math.round(finalResults.totalNetPercu).toLocaleString('fr-FR')} €
                      </div>
                      <p className="text text-sm mt-1">Total net perçu</p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Scénario avec réinvestissement */
                <div className="box">
                  <h3 className="text-lg font-semibold mb-4">Résultats avec réinvestissement ({
                    data.typeReinvestissement === 'VENTURE_CAPITAL' ? 'VC' :
                    data.typeReinvestissement === 'GROWTH_CAPITAL' ? 'Growth' :
                    data.typeReinvestissement === 'SECONDARY' ? 'Secondaire' : 'LBO'
                  })</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="box relative">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help absolute top-2 right-2" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Montant réellement décaissé de votre poche. Grâce au recyclage des distributions, ce montant est inférieur à votre souscription initiale car une partie des distributions retournent dans le fonds.</p>
                        </TooltipContent>
                      </Tooltip>
                      <div className="big-number text-xl font-bold">
                        {Math.round(finalResults.capitalRealInvesti).toLocaleString('fr-FR')} €
                      </div>
                      <p className="text text-sm mt-1">Capital réel investi</p>
                    </div>

                    <div className="box relative">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help absolute top-2 right-2" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Valeur totale de votre investissement avec réinvestissement des distributions dans un fonds {
                            data.typeReinvestissement === 'VENTURE_CAPITAL' ? 'VC (TRI 15%)' :
                            data.typeReinvestissement === 'GROWTH_CAPITAL' ? 'Growth Capital (TRI 13,3%)' : 
                            data.typeReinvestissement === 'SECONDARY' ? 'Secondaire (TRI 8,2%)' : 'LBO (TRI 9,6%)'
                          }.</p>
                        </TooltipContent>
                      </Tooltip>
                      <div className="big-number text-xl font-bold">
                        {Math.round(resultsAvecReinvestissement.valeurFinale).toLocaleString('fr-FR')} €
                      </div>
                      <p className="text text-sm mt-1">Valeur finale</p>
                    </div>

                    <div className="box relative">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help absolute top-2 right-2" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Frais totaux de la plateforme sur 10 ans, déduits de la valeur finale. Comprend les frais d'entrée et les frais annuels de gestion.</p>
                        </TooltipContent>
                      </Tooltip>
                      <div className="big-number text-xl font-bold text-destructive">
                        -{Math.round(finalResults.fraisTotaux).toLocaleString('fr-FR')} €
                      </div>
                      <p className="text text-sm mt-1">Frais totaux</p>
                    </div>

                    {data.souscription < 30000 && finalResults.interetsObligataires > 0 && (
                      <div className="box relative">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help absolute top-2 right-2" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Intérêts générés à 2%/an sur le capital placé en support obligataire dans le SPV, en attendant les appels de fonds. Ces intérêts sont capitalisés et consommés en priorité lors des appels.</p>
                          </TooltipContent>
                        </Tooltip>
                        <div className="big-number text-xl font-bold text-green-500">
                          +{Math.round(finalResults.interetsObligataires).toLocaleString('fr-FR')} €
                        </div>
                        <p className="text text-sm mt-1">Intérêts obligataires (2%)</p>
                      </div>
                    )}

                    <div className="box relative">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help absolute top-2 right-2" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Total Value to Paid-In capital avec réinvestissement : ratio entre la valeur finale totale (investissement initial + distributions réinvesties) et le capital réel investi.</p>
                        </TooltipContent>
                      </Tooltip>
                      <div className="big-number text-xl font-bold">
                        {Math.round(resultsAvecReinvestissement.moic * 100) / 100}x
                      </div>
                      <p className="text text-sm mt-1">TVPI</p>
                    </div>

                    <div className="box relative">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help absolute top-2 right-2" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Taux de Rendement Interne annualisé en réinvestissant les distributions dans un fonds {
                            data.typeReinvestissement === 'VENTURE_CAPITAL' ? 'VC' :
                            data.typeReinvestissement === 'GROWTH_CAPITAL' ? 'Growth Capital' : 
                            data.typeReinvestissement === 'SECONDARY' ? 'Secondaire' : 'LBO'
                          }.</p>
                        </TooltipContent>
                      </Tooltip>
                      <div className="big-number text-xl font-bold">
                        {(resultsAvecReinvestissement.triAnnuel * 100).toFixed(2)}%
                      </div>
                      <p className="text text-sm mt-1">TRI Annuel</p>
                    </div>

                    <div className="box relative">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help absolute top-2 right-2" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>
                            {data.profilInvestisseur === 'PERSONNE_PHYSIQUE' 
                              ? 'Impôts totaux avec flat tax 30% appliquée sur les plus-values des distributions réinvesties' 
                              : 'IS non calculé pour le moment'}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                      <div className="big-number text-xl font-bold text-amber-500">
                        {data.profilInvestisseur === 'PERSONNE_PHYSIQUE' 
                          ? `-${Math.round(resultsAvecReinvestissement.impotsTotaux).toLocaleString('fr-FR')} €`
                          : 'N/A'}
                      </div>
                      <p className="text text-sm mt-1">Impôts</p>
                    </div>

                    <div className="box relative">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help absolute top-2 right-2" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Total net perçu après impôts et frais, en incluant les gains générés par le réinvestissement des distributions.</p>
                        </TooltipContent>
                      </Tooltip>
                      <div className="big-number text-xl font-bold text-green-500">
                        {Math.round(resultsAvecReinvestissement.totalNetPercu).toLocaleString('fr-FR')} €
                      </div>
                      <p className="text text-sm mt-1">Total net perçu</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tableau en bas */}
          <div className="mt-8">
            <div className="box">
              <h3 className="text-lg font-semibold mb-4">Détail par année</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                   <thead>
                     <tr className="border-b">
                       <th className="text-left p-2">Année</th>
                       <th className="text-right p-2">
                         <div className="flex items-center justify-end gap-1">
                           Capital Call
                           <Tooltip>
                             <TooltipTrigger>
                               <Info className="w-3 h-3 text-muted-foreground hover:text-primary cursor-help" />
                             </TooltipTrigger>
                             <TooltipContent>
                               <p>Montant appelé par le fonds chaque année</p>
                             </TooltipContent>
                           </Tooltip>
                         </div>
                       </th>
                       {data.investmentType === 'DEBT' ? (
                         <>
                           <th className="text-right p-2">Coupon</th>
                           <th className="text-right p-2">Capital Rendu</th>
                         </>
                       ) : (
                         <th className="text-right p-2">Distribution</th>
                       )}
                       {data.investmentType !== 'DEBT' && (
                         <th className="text-right p-2">
                           <div className="flex items-center justify-end gap-1">
                             Distrib. Recyclée
                             <Tooltip>
                               <TooltipTrigger>
                                 <Info className="w-3 h-3 text-muted-foreground hover:text-primary cursor-help" />
                               </TooltipTrigger>
                               <TooltipContent className="max-w-xs">
                                 <p>Partie des distributions qui retourne automatiquement dans le fonds pour financer les futurs capital calls, réduisant votre cash réel à décaisser.</p>
                               </TooltipContent>
                             </Tooltip>
                           </div>
                         </th>
                       )}
                        <th className="text-right p-2">Cash Décaissé</th>
                        {!data.reinvestirDistributions && (
                          <th className="text-right p-2">
                            <div className="flex items-center justify-end gap-1">
                              Valeur Future
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="w-3 h-3 text-muted-foreground hover:text-primary cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p>Valeur de la distribution nette réinvestie à 15% annuel jusqu'à l'année 10. Représente la croissance de votre cash libre grâce au réinvestissement.</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </th>
                        )}
                        {data.reinvestirDistributions && (
                          <>
                            <th className="text-right p-2 bg-primary/5">
                              <div className="flex items-center justify-end gap-1">
                                Distrib. à Réinvestir
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Info className="w-3 h-3 text-muted-foreground hover:text-primary cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <p>Montant des distributions disponibles pour réinvestissement dans {data.typeReinvestissement === 'VENTURE_CAPITAL' ? 'VC' : data.typeReinvestissement === 'GROWTH_CAPITAL' ? 'Growth Capital' : data.typeReinvestissement === 'SECONDARY' ? 'Secondaire' : 'LBO'}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </th>
                            <th className="text-right p-2 bg-primary/5">
                              <div className="flex items-center justify-end gap-1">
                                Valeur Réinvestie
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Info className="w-3 h-3 text-muted-foreground hover:text-primary cursor-help" />
                                  </TooltipTrigger>
                                   <TooltipContent className="max-w-xs">
                                     <p>Valeur estimée de la distribution réinvestie avec un TRI de {data.typeReinvestissement === 'VENTURE_CAPITAL' ? '15%' : data.typeReinvestissement === 'GROWTH_CAPITAL' ? '13,3%' : data.typeReinvestissement === 'SECONDARY' ? '8,2%' : '9,6%'} annuel jusqu'à la fin du fonds (année {data.dureeVieFonds})</p>
                                   </TooltipContent>
                                </Tooltip>
                              </div>
                            </th>
                            <th className="text-right p-2 bg-primary/10">
                              <div className="flex items-center justify-end gap-1">
                                Plus-value
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Info className="w-3 h-3 text-muted-foreground hover:text-primary cursor-help" />
                                  </TooltipTrigger>
                                   <TooltipContent className="max-w-xs">
                                     <p>Plus-value générée par le réinvestissement = Valeur Réinvestie - Distribution à Réinvestir</p>
                                   </TooltipContent>
                                </Tooltip>
                              </div>
                            </th>
                          </>
                        )}
                      </tr>
                   </thead>
                   <tbody>
                      {results.map((year, index) => {
                        // Calculer les valeurs de réinvestissement pour chaque année avec TRI
                        const distributionNette = year.distribution - year.distributionRecyclee;
                        const triReinvest = data.typeReinvestissement === 'VENTURE_CAPITAL' ? 0.15 : 
                                            data.typeReinvestissement === 'GROWTH_CAPITAL' ? 0.133 :
                                            data.typeReinvestissement === 'SECONDARY' ? 0.082 : 0.096;
                        const anneesRestantes = data.dureeVieFonds - year.annee;
                        const valeurReinvestie = distributionNette * Math.pow(1 + triReinvest, Math.max(0, anneesRestantes));
                       
                       return (
                         <tr key={index} className="border-b border-border hover:bg-muted/50">
                           <td className="p-2 font-medium">{year.annee}</td>
                           <td className="text-right p-2 text-red-400">
                              {year.capitalCall < 0 ? `${Math.round(year.capitalCall).toLocaleString('fr-FR')} €` : '-'}
                            </td>
                            {data.investmentType === 'DEBT' ? (
                              <>
                                <td className="text-right p-2 text-green-400">
                                  {(year.coupon && year.coupon > 0) ? `${Math.round(year.coupon).toLocaleString('fr-FR')} €` : '-'}
                                </td>
                                <td className="text-right p-2 text-blue-400">
                                  {(year.capitalRendu && year.capitalRendu > 0) ? `${Math.round(year.capitalRendu).toLocaleString('fr-FR')} €` : '-'}
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="text-right p-2 text-green-400">
                                  {year.distribution > 0 ? `${Math.round(year.distribution).toLocaleString('fr-FR')} €` : '-'}
                                </td>
                                <td className="text-right p-2 text-blue-400 italic">
                                  {year.distributionRecyclee > 0 ? `${Math.round(year.distributionRecyclee).toLocaleString('fr-FR')} €` : '-'}
                                </td>
                              </>
                            )}
                            <td className="text-right p-2 font-medium">
                              <span className={year.montantRealDecaisse > 0 ? 'text-green-400' : year.montantRealDecaisse < 0 ? 'text-red-400' : ''}>
                                {Math.round(year.montantRealDecaisse).toLocaleString('fr-FR')} €
                              </span>
                            </td>
                            {!data.reinvestirDistributions && (
                              <td className="text-right p-2 text-primary">
                                {year.valeurFuture > 0 ? `${Math.round(year.valeurFuture).toLocaleString('fr-FR')} €` : '-'}
                              </td>
                            )}
                           {data.reinvestirDistributions && (
                             <>
                               <td className="text-right p-2 bg-primary/5 text-purple-400">
                                 {distributionNette > 0 ? `${Math.round(distributionNette).toLocaleString('fr-FR')} €` : '-'}
                               </td>
                               <td className="text-right p-2 bg-primary/5 text-primary font-medium">
                                 {valeurReinvestie > 0 ? `${Math.round(valeurReinvestie).toLocaleString('fr-FR')} €` : '-'}
                               </td>
                               <td className="text-right p-2 bg-primary/10 text-green-400 font-medium">
                                 {valeurReinvestie > 0 ? `+${Math.round(valeurReinvestie - distributionNette).toLocaleString('fr-FR')} €` : '-'}
                               </td>
                             </>
                           )}
                         </tr>
                       );
                     })}
                   </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}