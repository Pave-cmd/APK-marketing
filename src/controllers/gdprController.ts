import { Response } from 'express';
import { AuthRequest } from '../types/express';
import User from '../models/User';
import ApiConfig from '../models/ApiConfig';
import Content from '../models/Content';
import ScheduledPost from '../models/ScheduledPost';
import WebAnalysis from '../models/WebAnalysis';
import { promises as fs } from 'fs';
import path from 'path';
import archiver from 'archiver';

// Získání souhlasu uživatele
export const updateConsent = async (req: AuthRequest, res: Response) => {
  try {
    const { consentGiven } = req.body as { consentGiven: boolean };
    
    if (!req.userId) {
      res.status(401).json({ success: false, error: 'Neautorizovaný přístup' });
      return;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'Uživatel nenalezen' });
      return;
    }

    // Aktualizace souhlasu
    user.consentGiven = consentGiven;
    if (consentGiven) {
      user.consentDate = new Date();
    }

    await user.save();

    res.json({ 
      success: true, 
      message: 'Souhlas byl úspěšně aktualizován',
      consentGiven: user.consentGiven,
      consentDate: user.consentDate
    });
  } catch (error) {
    console.error('Chyba při aktualizaci souhlasu:', error);
    res.status(500).json({ success: false, error: 'Chyba při aktualizaci souhlasu' });
      return;
  }
};

// Export uživatelských dat
export const exportUserData = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, error: 'Neautorizovaný přístup' });
      return;
    }

    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      res.status(404).json({ success: false, error: 'Uživatel nenalezen' });
      return;
    }

    // Zaznamenání žádosti o export
    user.dataExportRequest = new Date();
    await user.save();

    // Shromáždění všech uživatelských dat
    const userData = {
      personalInfo: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        company: user.company,
        plan: user.plan,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      },
      websites: user.websites,
      socialNetworks: user.socialNetworks.map(sn => ({
        platform: sn.platform,
        username: sn.username,
        pageName: sn.pageName,
        connectedAt: sn.connectedAt,
        publishSettings: sn.publishSettings
      })),
      gdprConsent: user.gdprConsent,
      dataProcessingConsent: user.dataProcessingConsent,
      consentGiven: user.consentGiven,
      consentDate: user.consentDate
    };

    // Získání souvisejících dat
    const [apiConfigs, contents, scheduledPosts, webAnalyses] = await Promise.all([
      ApiConfig.find({ user: req.userId }).select('-accessToken -refreshToken'),
      Content.find({ user: req.userId }),
      ScheduledPost.find({ user: req.userId }),
      WebAnalysis.find({ userId: req.userId })
    ]);

    // Vytvoření dočasného adresáře pro export
    const exportDir = path.join(__dirname, '../../temp', req.userId);
    await fs.mkdir(exportDir, { recursive: true });

    // Uložení dat do JSON souborů
    await Promise.all([
      fs.writeFile(path.join(exportDir, 'user-data.json'), JSON.stringify(userData, null, 2)),
      fs.writeFile(path.join(exportDir, 'api-configs.json'), JSON.stringify(apiConfigs, null, 2)),
      fs.writeFile(path.join(exportDir, 'contents.json'), JSON.stringify(contents, null, 2)),
      fs.writeFile(path.join(exportDir, 'scheduled-posts.json'), JSON.stringify(scheduledPosts, null, 2)),
      fs.writeFile(path.join(exportDir, 'web-analyses.json'), JSON.stringify(webAnalyses, null, 2))
    ]);

    // Vytvoření ZIP archivu
    const archive = archiver('zip', { zlib: { level: 9 } });
    const zipPath = path.join(__dirname, '../../temp', `${req.userId}-data-export.zip`);
    const output = require('fs').createWriteStream(zipPath);

    archive.pipe(output);
    archive.directory(exportDir, false);
    await archive.finalize();

    // Odeslání ZIP souboru
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    res.download(zipPath, `apk-marketing-data-export-${new Date().toISOString().split('T')[0]}.zip`, async (_err) => {
      // Vyčištění dočasných souborů
      try {
        await fs.rm(exportDir, { recursive: true, force: true });
        await fs.unlink(zipPath);
      } catch (cleanupError) {
        console.error('Chyba při čištění temp souborů:', cleanupError);
      }
    });
  } catch (error) {
    console.error('Chyba při exportu dat:', error);
    res.status(500).json({ success: false, error: 'Chyba při exportu dat' });
      return;
  }
};

// Žádost o smazání dat
export const requestDataDeletion = async (req: AuthRequest, res: Response) => {
  try {
    const { password, confirmDeletion } = req.body as { password: string; confirmDeletion: boolean };

    if (!req.userId) {
      res.status(401).json({ success: false, error: 'Neautorizovaný přístup' });
      return;
    }

    if (!confirmDeletion) {
      res.status(400).json({ success: false, error: 'Musíte potvrdit smazání účtu' });
      return;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'Uživatel nenalezen' });
      return;
    }

    // Ověření hesla
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      res.status(401).json({ success: false, error: 'Nesprávné heslo' });
      return;
    }

    // Zaznamenání žádosti o smazání
    user.dataDeletionRequest = new Date();
    await user.save();

    // Plánované smazání po 30 dnech (dává uživateli čas to zrušit)
    res.json({ 
      success: true, 
      message: 'Žádost o smazání byla zaznamenána. Váš účet a všechna související data budou smazána za 30 dní. Pokud si to rozmyslíte, kontaktujte nás.',
      deletionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
  } catch (error) {
    console.error('Chyba při žádosti o smazání dat:', error);
    res.status(500).json({ success: false, error: 'Chyba při zpracování žádosti' });
      return;
  }
};

// Okamžité smazání dat (pro testování nebo urgentní případy)
export const deleteUserDataImmediately = async (req: AuthRequest, res: Response) => {
  try {
    const { password, confirmPhrase } = req.body as { password: string; confirmPhrase: string };

    if (!req.userId) {
      res.status(401).json({ success: false, error: 'Neautorizovaný přístup' });
      return;
    }

    if (confirmPhrase !== 'DELETE MY ACCOUNT PERMANENTLY') {
      res.status(400).json({ success: false, error: 'Nesprávná potvrzovací fráze' });
      return;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'Uživatel nenalezen' });
      return;
    }

    // Ověření hesla
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      res.status(401).json({ success: false, error: 'Nesprávné heslo' });
      return;
    }

    // Smazání všech souvisejících dat
    await Promise.all([
      ApiConfig.deleteMany({ user: req.userId }),
      Content.deleteMany({ user: req.userId }),
      ScheduledPost.deleteMany({ user: req.userId }),
      WebAnalysis.deleteMany({ userId: req.userId }),
      User.findByIdAndDelete(req.userId)
    ]);

    // Zneplatnění JWT tokenu (logout)
    res.clearCookie('token');

    res.json({ 
      success: true, 
      message: 'Váš účet a všechna související data byla úspěšně smazána.' 
    });
  } catch (error) {
    console.error('Chyba při mazání dat:', error);
    res.status(500).json({ success: false, error: 'Chyba při mazání dat' });
      return;
  }
};

// Získání informací o GDPR souhlasech
export const getGdprStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, error: 'Neautorizovaný přístup' });
      return;
    }

    const user = await User.findById(req.userId).select('gdprConsent dataProcessingConsent consentGiven consentDate dataExportRequest dataDeletionRequest');
    if (!user) {
      res.status(404).json({ success: false, error: 'Uživatel nenalezen' });
      return;
    }

    res.json({
      success: true,
      gdprStatus: {
        generalConsent: {
          given: user.consentGiven,
          date: user.consentDate
        },
        gdprConsent: user.gdprConsent,
        dataProcessingConsent: user.dataProcessingConsent,
        dataRequests: {
          lastExportRequest: user.dataExportRequest,
          deletionRequest: user.dataDeletionRequest,
          deletionScheduledFor: user.dataDeletionRequest ? new Date(user.dataDeletionRequest.getTime() + 30 * 24 * 60 * 60 * 1000) : null
        }
      }
    });
  } catch (error) {
    console.error('Chyba při získávání GDPR statusu:', error);
    res.status(500).json({ success: false, error: 'Chyba při získávání GDPR statusu' });
      return;
  }
};