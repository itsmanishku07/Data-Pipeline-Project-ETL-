import logging
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from croniter import croniter
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from ..models.db_models import CatalogDB
from ..models.schemas import (
    PipelineExecutionRequest,
    TransformationRule,
    ExportDestinationRequest,
    FileFormat
)
from .job_service import JobService

logger = logging.getLogger("dataflow.scheduler")

CRON_PRESETS = {
    "*/5 * * * *": "Every 5 minutes",
    "*/10 * * * *": "Every 10 minutes",
    "*/15 * * * *": "Every 15 minutes",
    "*/30 * * * *": "Every 30 minutes",
    "0 * * * *": "Every hour (at minute 0)",
    "0 */2 * * *": "Every 2 hours",
    "0 */6 * * *": "Every 6 hours",
    "0 */12 * * *": "Every 12 hours",
    "0 0 * * *": "Every day at midnight (00:00 UTC)",
    "0 2 * * *": "Every day at 02:00 AM UTC",
    "0 6 * * *": "Every day at 06:00 AM UTC",
    "0 12 * * *": "Every day at 12:00 PM (Noon UTC)",
    "0 18 * * *": "Every day at 06:00 PM UTC",
    "0 0 * * 1": "Every Monday at midnight (00:00 UTC)",
    "0 0 * * 5": "Every Friday at midnight (00:00 UTC)",
    "0 0 1 * *": "1st day of every month at midnight",
}

def describe_cron(cron_expr: str) -> str:
    """Returns a friendly description for a cron expression."""
    clean = (cron_expr or "").strip()
    if clean in CRON_PRESETS:
        return CRON_PRESETS[clean]
    
    parts = clean.split()
    if len(parts) == 5:
        m, h, dom, mon, dow = parts
        if m.startswith("*/"):
            return f"Every {m[2:]} minutes"
        if m == "0" and h.startswith("*/"):
            return f"Every {h[2:]} hours"
        if dom == "*" and mon == "*" and dow == "*":
            return f"Daily at {h.zfill(2)}:{m.zfill(2)} UTC"
        if dom == "*" and mon == "*" and dow != "*":
            days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
            try:
                day_name = days[int(dow)]
                return f"Weekly on {day_name} at {h.zfill(2)}:{m.zfill(2)} UTC"
            except Exception:
                pass
    return f"Custom schedule ({clean})"

def calculate_next_runs(cron_expr: str, base_time: Optional[datetime] = None, count: int = 5) -> List[str]:
    """Calculates upcoming run timestamps for a cron expression."""
    try:
        now = base_time or datetime.now(timezone.utc)
        itr = croniter(cron_expr.strip(), now)
        runs = []
        for _ in range(count):
            next_dt = itr.get_next(datetime)
            runs.append(next_dt.isoformat())
        return runs
    except Exception as e:
        logger.warning(f"Error calculating next runs for cron '{cron_expr}': {e}")
        return []

class SchedulerService:
    _scheduler: Optional[BackgroundScheduler] = None
    _lock = threading.RLock()
    _is_running = False

    @classmethod
    def get_scheduler(cls) -> BackgroundScheduler:
        with cls._lock:
            if cls._scheduler is None:
                cls._scheduler = BackgroundScheduler(
                    daemon=True,
                    timezone=timezone.utc,
                    job_defaults={
                        "coalesce": True,
                        "max_instances": 1,
                        "misfire_grace_time": 60
                    }
                )
            return cls._scheduler

    @classmethod
    def start(cls):
        """Starts background scheduler daemon and registers all active schedules from DB."""
        sched = cls.get_scheduler()
        with cls._lock:
            if not cls._is_running:
                try:
                    sched.start()
                    cls._is_running = True
                    logger.info("DataFlow Background Cron Scheduler started.")
                    cls.reload_all_schedules()
                except Exception as e:
                    logger.error(f"Failed to start scheduler: {e}")

    @classmethod
    def shutdown(cls):
        """Shuts down background scheduler."""
        with cls._lock:
            if cls._scheduler and cls._is_running:
                try:
                    cls._scheduler.shutdown(wait=False)
                    cls._is_running = False
                    logger.info("DataFlow Background Cron Scheduler stopped.")
                except Exception as e:
                    logger.error(f"Error during scheduler shutdown: {e}")

    @classmethod
    def reload_all_schedules(cls):
        """Loads all schedules from catalog database and synchronizes with scheduler jobs."""
        try:
            schedules = CatalogDB.get_schedules()
            for sched_data in schedules:
                cls.sync_job(sched_data)
        except Exception as e:
            logger.error(f"Failed to reload schedules from database: {e}")

    @classmethod
    def sync_job(cls, schedule_data: Dict[str, Any]):
        """Adds or updates a scheduled job in APScheduler."""
        sched = cls.get_scheduler()
        job_id = schedule_data["id"]
        cron_expr = schedule_data.get("cron_expression", "").strip()
        enabled = schedule_data.get("enabled", True)

        # Remove existing job if any
        if sched.get_job(job_id):
            sched.remove_job(job_id)

        if not enabled:
            return

        try:
            parts = cron_expr.split()
            if len(parts) != 5:
                logger.warning(f"Invalid cron expression '{cron_expr}' for schedule {job_id}")
                return

            trigger = CronTrigger(
                minute=parts[0],
                hour=parts[1],
                day=parts[2],
                month=parts[3],
                day_of_week=parts[4],
                timezone=timezone.utc
            )

            next_runs = calculate_next_runs(cron_expr, count=1)
            next_run_iso = next_runs[0] if next_runs else None
            if next_run_iso:
                CatalogDB.update_schedule(job_id, {"next_run_at": next_run_iso})

            sched.add_job(
                func=cls.run_scheduled_job,
                trigger=trigger,
                args=[job_id],
                id=job_id,
                name=f"Schedule: {schedule_data.get('name', job_id)}",
                replace_existing=True
            )
            logger.info(f"Registered scheduled job '{job_id}' ({cron_expr}) -> Next run at {next_run_iso}")
        except Exception as e:
            logger.error(f"Failed to register cron job for schedule {job_id}: {e}")

    @classmethod
    def remove_job(cls, schedule_id: str):
        """Removes a job from APScheduler."""
        sched = cls.get_scheduler()
        if sched.get_job(schedule_id):
            sched.remove_job(schedule_id)
            logger.info(f"Removed scheduled job '{schedule_id}' from scheduler.")

    @classmethod
    def run_scheduled_job(cls, schedule_id: str) -> Dict[str, Any]:
        """
        Executes a scheduled flow:
        1. Loads schedule and flow configurations.
        2. Executes transformation rules on staged dataset.
        3. Loads output directly to configured destination (Azure/DB/S3/Lakehouse).
        4. Updates execution metrics and calculates next run time.
        """
        sched_data = CatalogDB.get_schedule(schedule_id)
        if not sched_data:
            logger.warning(f"Schedule '{schedule_id}' not found in database.")
            return {"success": False, "error": "Schedule not found"}

        flow_id = sched_data["flow_id"]
        sched_name = sched_data["name"]
        staging_dataset_id = sched_data["staging_dataset_id"]
        cron_expr = sched_data.get("cron_expression", "")

        rules_data = CatalogDB.get_flow_rules(flow_id)
        rules = [TransformationRule(**r) for r in rules_data] if rules_data else []

        dest_cfg = sched_data.get("destination_config")
        destination_request = None
        if dest_cfg:
            try:
                destination_request = ExportDestinationRequest(**dest_cfg) if isinstance(dest_cfg, dict) else dest_cfg
            except Exception as e:
                logger.warning(f"Failed to parse destination request for schedule {schedule_id}: {e}")

        pipeline_req = PipelineExecutionRequest(
            name=f"[CRON] {sched_name}",
            staging_dataset_id=staging_dataset_id,
            rules=rules,
            output_dataset_name=f"curated_{flow_id}",
            output_description=f"Automated scheduled run by trigger '{sched_name}'",
            flow_id=flow_id,
            stage_output=True,
            destination_config=destination_request
        )

        logger.info(f"Executing scheduled job '{sched_name}' for flow '{flow_id}' (Rules: {len(rules)})...")

        next_runs = calculate_next_runs(cron_expr, count=1)
        next_run_dt = datetime.fromisoformat(next_runs[0]) if next_runs else None

        try:
            job_status = JobService.execute_pipeline(pipeline_req)
            
            CatalogDB.record_schedule_run(
                schedule_id=schedule_id,
                job_id=job_status.id,
                status=job_status.status.value,
                message=job_status.message,
                next_run_at=next_run_dt
            )

            CatalogDB.record_audit_log(
                event_type="SCHEDULED_FLOW_TRIGGERED",
                entity_id=schedule_id,
                entity_type="FLOW_SCHEDULE",
                summary=f"Automated schedule '{sched_name}' executed flow '{flow_id}' ({job_status.output_rows} rows processed)"
            )

            return {
                "success": True,
                "job_id": job_status.id,
                "status": job_status.status.value,
                "message": job_status.message,
                "output_rows": job_status.output_rows,
                "next_run_at": next_run_dt.isoformat() if next_run_dt else None
            }
        except Exception as e:
            err_msg = f"Scheduled execution failed: {str(e)}"
            logger.error(err_msg)
            
            CatalogDB.record_schedule_run(
                schedule_id=schedule_id,
                job_id="",
                status="FAILED",
                message=err_msg,
                next_run_at=next_run_dt
            )
            return {
                "success": False,
                "error": err_msg,
                "next_run_at": next_run_dt.isoformat() if next_run_dt else None
            }

