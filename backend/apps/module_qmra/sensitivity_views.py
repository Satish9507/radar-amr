import uuid
import threading

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .sensitivity import run_sensitivity_analysis

# In-memory task store (keyed by uuid4, sufficient for single-server deployment)
_TASK_STORE: dict = {}
_STORE_LOCK = threading.Lock()

_MAX_N_SIM = 100_000
_DEFAULT_N_SIM = 10_000


class QMRASensitivityView(APIView):
    """
    POST /api/v1/qmra/sensitivity/
    Body: { "records": [...], "n_sim": 10000 }

    Launches a background thread; returns { "task_id": "<uuid>" }.
    Poll the status endpoint to retrieve the result.
    """

    def post(self, request):
        records = request.data.get('records', [])
        if not records:
            return Response(
                {'status': 'error', 'message': 'No records provided. Send the results array from a prior calculation.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            n_sim = int(request.data.get('n_sim', _DEFAULT_N_SIM))
        except (TypeError, ValueError):
            n_sim = _DEFAULT_N_SIM
        n_sim = max(1_000, min(n_sim, _MAX_N_SIM))

        task_id = str(uuid.uuid4())
        with _STORE_LOCK:
            _TASK_STORE[task_id] = {'status': 'running'}

        def _run():
            try:
                result = run_sensitivity_analysis(records, n_sim=n_sim)
                with _STORE_LOCK:
                    _TASK_STORE[task_id] = {'status': 'complete', 'result': result}
            except Exception as exc:
                with _STORE_LOCK:
                    _TASK_STORE[task_id] = {'status': 'error', 'message': str(exc)}

        thread = threading.Thread(target=_run, daemon=True)
        thread.start()

        return Response({'status': 'queued', 'task_id': task_id}, status=status.HTTP_202_ACCEPTED)


class QMRASensitivityStatusView(APIView):
    """
    GET /api/v1/qmra/sensitivity/status/<task_id>/

    Returns:
      { status: "running" }
      { status: "complete", result: { ... } }
      { status: "error",    message: "..." }
    """

    def get(self, request, task_id):
        with _STORE_LOCK:
            task = _TASK_STORE.get(task_id)

        if task is None:
            return Response(
                {'status': 'error', 'message': 'Task not found. It may have expired after a server restart.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(task)
